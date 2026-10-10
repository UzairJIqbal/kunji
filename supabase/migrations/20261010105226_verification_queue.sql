-- Phase 6: the seller approves or rejects each payment, sends money back when
-- a rejected order can't go ahead, and tells customers when they're away.
--
-- Errors the seller can run into carry their own SQLSTATE, as in checkout:
--   KJ006  the order isn't in a state this decision applies to (another
--          device got there first, or the page was stale)


-- ───────────────────────────── Rejections ─────────────────────────────

-- Why the seller rejected a payment, in words the customer reads. Who rejected
-- it and when is the order event. An order can be rejected once at most: there
-- is no move back to verifying, so the order ID is the key.
create table public.payment_rejections (
  order_id uuid primary key,
  customer_id public.clerk_user_id not null,
  reason text not null check (length(trim(reason)) between 1 and 200),
  created_at timestamptz not null default now(),
  foreign key (order_id, customer_id) references public.orders (id, customer_id)
);


-- ───────────────────────────── Refunds ─────────────────────────────

-- Money the seller sent back. Refunded is a final state, so one per order.
-- sent_to is the number or account the customer paid from, copied when the
-- refund is recorded. refunded_by is null only when written directly on the
-- database, as with order_events.actor_id.
create table public.refunds (
  order_id uuid primary key,
  customer_id public.clerk_user_id not null,
  amount integer not null check (amount > 0),
  method public.payment_method not null,
  reference text not null check (length(trim(reference)) between 1 and 64),
  sent_to text not null check (length(trim(sent_to)) between 1 and 34),
  refunded_by public.clerk_user_id,
  created_at timestamptz not null default now(),
  foreign key (order_id, customer_id) references public.orders (id, customer_id)
);

-- A refund never exceeds what the order cost, and who sent it is whoever is
-- signed in, never a value from the request. Held here so it holds however
-- the row is written.
create function private.refunds_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_price integer;
begin
  select o.price into order_price from public.orders o where o.id = new.order_id;
  if new.amount > order_price then
    raise exception 'A refund of % is more than the order''s price of %', new.amount, order_price
      using errcode = 'check_violation';
  end if;
  new.refunded_by := private.requesting_user_id();
  new.created_at := now();
  return new;
end;
$$;

create trigger refunds_before_insert
  before insert on public.refunds
  for each row execute function private.refunds_before_insert();


-- ───────────────────────────── Status moves ─────────────────────────────

-- As before, plus: rejected needs a reason on record, and refunded needs the
-- refund on record, so neither state can exist without its evidence.
create or replace function private.orders_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.id, new.customer_id, new.plan_id, new.price, new.product_name,
      new.duration_days, new.warranty_days, new.created_at)
     is distinct from
     (old.id, old.customer_id, old.plan_id, old.price, old.product_name,
      old.duration_days, old.warranty_days, old.created_at) then
    raise exception 'Order % keeps the terms it was placed with', old.number
      using errcode = 'check_violation';
  end if;

  -- An email can be corrected, never added or taken away: whether an order
  -- has one was settled by its product when it was placed.
  if (new.activation_email is null) <> (old.activation_email is null) then
    raise exception 'Order % can correct its activation email, not add or remove one', old.number
      using errcode = 'check_violation';
  end if;

  if new.status is distinct from old.status then
    if not exists (
      select 1 from public.order_status_moves m
      where m.from_status = old.status and m.to_status = new.status
    ) then
      raise exception 'Order % cannot move from % to %',
        old.number, old.status, new.status
        using errcode = 'check_violation';
    end if;

    if new.status = 'verifying' and not exists (
      select 1 from public.payments p where p.order_id = new.id
    ) then
      raise exception 'Order % has no payment proof, so it cannot be verifying',
        old.number
        using errcode = 'check_violation';
    end if;

    if new.status = 'rejected' and not exists (
      select 1 from public.payment_rejections r where r.order_id = new.id
    ) then
      raise exception 'Order % has no rejection reason recorded, so it cannot be rejected',
        old.number
        using errcode = 'check_violation';
    end if;

    if new.status = 'bought' and not exists (
      select 1 from public.supplier_purchases s where s.order_id = new.id
    ) then
      raise exception 'Order % has no supplier order number recorded, so it cannot be bought',
        old.number
        using errcode = 'check_violation';
    end if;

    if new.status = 'refunded' and not exists (
      select 1 from public.refunds r where r.order_id = new.id
    ) then
      raise exception 'Order % has no refund recorded, so it cannot be refunded',
        old.number
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;


-- ───────────────────────────── Away switch ─────────────────────────────

-- One row, always there. back_at is a time of day in Pakistan time, as the
-- seller types it ("10am"); it's kept when the switch goes off so the form
-- starts with the last one used.
create table public.store_settings (
  id boolean primary key default true check (id),
  away boolean not null default false,
  back_at time,
  check (not away or back_at is not null)
);

insert into public.store_settings default values;


-- ───────────────────────────── Policies ─────────────────────────────

create policy "read own rejections or admin" on public.payment_rejections
  for select to authenticated
  using (customer_id = (select private.requesting_user_id()) or (select private.is_admin()));
create policy "admin records rejections" on public.payment_rejections
  for insert to authenticated with check ((select private.is_admin()));

create policy "read own refunds or admin" on public.refunds
  for select to authenticated
  using (customer_id = (select private.requesting_user_id()) or (select private.is_admin()));
create policy "admin records refunds" on public.refunds
  for insert to authenticated with check ((select private.is_admin()));

-- Every storefront page shows the banner, signed in or not.
create policy "anyone reads store settings" on public.store_settings
  for select to anon, authenticated using (true);
create policy "admin updates store settings" on public.store_settings
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Rejections and refunds are history: written once, never changed or removed
-- through the API. The settings row is never added to or removed.
revoke all on public.payment_rejections, public.refunds, public.store_settings
  from anon, authenticated;
grant select, insert on public.payment_rejections, public.refunds to authenticated;
grant select on public.store_settings to anon, authenticated;
grant update (away, back_at) on public.store_settings to authenticated;


-- ───────────────────────────── Decisions ─────────────────────────────
--
-- Each locks the order first, so two devices deciding at once queue up and the
-- second finds the order already moved (KJ006) rather than deciding twice.
-- Invoker rights: the policies still decide every write; the admin check up
-- front turns a customer's call into a clear refusal instead of a quiet miss.

create function public.approve_payment(p_order_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_status public.order_status;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can approve a payment' using errcode = 'insufficient_privilege';
  end if;

  select o.status into current_status from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'Order % was not found', p_order_id using errcode = 'no_data_found';
  end if;
  -- From rejected too: the money can turn up after the seller said it hadn't.
  if current_status not in ('verifying', 'rejected') then
    raise exception 'Order % is %, so there is no payment to approve', p_order_id, current_status
      using errcode = 'KJ006';
  end if;

  update public.orders set status = 'paid' where id = p_order_id;
end;
$$;

create function public.reject_payment(p_order_id uuid, p_reason text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target record;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can reject a payment' using errcode = 'insufficient_privilege';
  end if;

  select o.status, o.customer_id into target from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'Order % was not found', p_order_id using errcode = 'no_data_found';
  end if;
  if target.status <> 'verifying' then
    raise exception 'Order % is %, so there is no payment to reject', p_order_id, target.status
      using errcode = 'KJ006';
  end if;

  insert into public.payment_rejections (order_id, customer_id, reason)
  values (p_order_id, target.customer_id, trim(p_reason));

  update public.orders set status = 'rejected' where id = p_order_id;
end;
$$;

-- Money that arrived for an order that can't go ahead goes back to where it
-- came from: the number or account on the customer's latest proof.
create function public.refund_rejected_order(
  p_order_id uuid,
  p_amount integer,
  p_method public.payment_method,
  p_reference text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target record;
  paid_from text;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can record a refund' using errcode = 'insufficient_privilege';
  end if;

  select o.status, o.customer_id into target from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'Order % was not found', p_order_id using errcode = 'no_data_found';
  end if;
  if target.status <> 'rejected' then
    raise exception 'Order % is %, not rejected', p_order_id, target.status
      using errcode = 'KJ006';
  end if;

  select p.sender_number into paid_from
    from public.payments p
    where p.order_id = p_order_id
    order by p.created_at desc
    limit 1;

  insert into public.refunds (order_id, customer_id, amount, method, reference, sent_to)
  values (p_order_id, target.customer_id, p_amount, p_method, trim(p_reference), paid_from);

  update public.orders set status = 'refunded' where id = p_order_id;
end;
$$;

revoke execute on function public.approve_payment(uuid) from public, anon;
grant execute on function public.approve_payment(uuid) to authenticated;

revoke execute on function public.reject_payment(uuid, text) from public, anon;
grant execute on function public.reject_payment(uuid, text) to authenticated;

revoke execute on function public.refund_rejected_order(uuid, integer, public.payment_method, text)
  from public, anon;
grant execute on function public.refund_rejected_order(uuid, integer, public.payment_method, text)
  to authenticated;


-- ───────────────────────────── Live updates ─────────────────────────────

-- Realtime sends each change only to subscribers whose policies let them read
-- the row: a customer hears about their own orders, an admin about all of
-- them, anyone about the away switch.
alter publication supabase_realtime add table public.orders, public.store_settings;
