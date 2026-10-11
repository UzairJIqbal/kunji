-- Phase 7: the seller buys each paid order on numastore and records it, or
-- records that numastore can't supply it and sends the money back.
--
-- Errors the seller can run into, as before:
--   KJ006  the order isn't in a state this decision applies to
--   KJ007  the order has no payment to refund to
--   KJ008  numastore can't supply this order, so it can't be bought, or it
--          hasn't been recorded as unsuppliable, so it can't be refunded
-- A numastore order number already on another order is the unique
-- constraint's own 23505.


-- ───────────────────────────── Purchases ─────────────────────────────

-- Stored with spaces gone and in capitals, as transaction IDs are, so a
-- number pasted twice with a stray space is still caught as the same one.
-- The seed's purchases are already in this form.
alter table public.supplier_purchases
  add constraint supplier_purchases_order_number_normalised_check
    check (supplier_order_number = upper(regexp_replace(supplier_order_number, '[[:space:]]', '', 'g'))
           and length(supplier_order_number) <= 64);


-- ───────────────────────────── Can't supply ─────────────────────────────

-- numastore couldn't supply a paid order. The order stays paid, off the buy
-- list and on the refunds-to-send list, until the refund is recorded. Its
-- customer may read it: it says only that the item was out of stock, and the
-- order page uses it to tell them why they were refunded. Who recorded it and
-- when is here because no status move records it.
create table public.supply_failures (
  order_id uuid primary key,
  customer_id public.clerk_user_id not null,
  recorded_by public.clerk_user_id,
  created_at timestamptz not null default now(),
  foreign key (order_id, customer_id) references public.orders (id, customer_id)
);

create function private.supply_failures_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.recorded_by := private.requesting_user_id();
  new.created_at := now();
  return new;
end;
$$;

create trigger supply_failures_before_insert
  before insert on public.supply_failures
  for each row execute function private.supply_failures_before_insert();

create policy "read own supply failures or admin" on public.supply_failures
  for select to authenticated
  using (customer_id = (select private.requesting_user_id()) or (select private.is_admin()));
create policy "admin records supply failures" on public.supply_failures
  for insert to authenticated with check ((select private.is_admin()));

-- History: written once, never changed or removed through the API.
revoke all on public.supply_failures from anon, authenticated;
grant select, insert on public.supply_failures to authenticated;


-- ───────────────────────────── Status moves ─────────────────────────────

-- As before, plus: an order numastore can't supply can't be bought, and a
-- paid order is only refunded once numastore's failure is on record.
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

    if new.status = 'bought' and exists (
      select 1 from public.supply_failures f where f.order_id = new.id
    ) then
      raise exception 'Order % is recorded as unsuppliable, so it cannot be bought',
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

    if old.status = 'paid' and new.status = 'refunded' and not exists (
      select 1 from public.supply_failures f where f.order_id = new.id
    ) then
      raise exception 'Order % is paid and not recorded as unsuppliable, so it cannot be refunded',
        old.number
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;


-- ───────────────────────────── Decisions ─────────────────────────────
--
-- As in Phase 6: each checks the caller is an admin, locks the order so two
-- devices queue up, and leaves every write to the policies (invoker rights).

-- The seller bought it on numastore. The number and the amount are what they
-- typed; the order moves to bought only with the purchase on record (the
-- trigger), and the plan's supplier price is never touched here.
create function public.mark_order_bought(
  p_order_id uuid,
  p_supplier_order_number text,
  p_amount_paid integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_status public.order_status;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can record a purchase' using errcode = 'insufficient_privilege';
  end if;

  select o.status into current_status from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'Order % was not found', p_order_id using errcode = 'no_data_found';
  end if;
  if current_status <> 'paid' then
    raise exception 'Order % is %, so there is nothing to buy', p_order_id, current_status
      using errcode = 'KJ006';
  end if;
  if exists (select 1 from public.supply_failures f where f.order_id = p_order_id) then
    raise exception 'Order % is recorded as unsuppliable', p_order_id using errcode = 'KJ008';
  end if;

  insert into public.supplier_purchases (order_id, supplier_order_number, amount_paid)
  values (
    p_order_id,
    upper(regexp_replace(p_supplier_order_number, '[[:space:]]', '', 'g')),
    p_amount_paid
  );

  update public.orders set status = 'bought' where id = p_order_id;
end;
$$;

-- numastore can't supply it: the product is marked sold out so nobody else
-- orders it, and the order waits for its refund. Together or not at all.
create function public.record_cannot_supply(p_order_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target record;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can record this' using errcode = 'insufficient_privilege';
  end if;

  select o.status, o.customer_id, pl.product_id into target
    from public.orders o
    join public.plans pl on pl.id = o.plan_id
    where o.id = p_order_id
    for update of o;
  if not found then
    raise exception 'Order % was not found', p_order_id using errcode = 'no_data_found';
  end if;
  if target.status <> 'paid'
     or exists (select 1 from public.supply_failures f where f.order_id = p_order_id) then
    raise exception 'Order % is %, or already recorded, so this does not apply', p_order_id, target.status
      using errcode = 'KJ006';
  end if;

  insert into public.supply_failures (order_id, customer_id)
  values (p_order_id, target.customer_id);

  update public.products set sold_out = true where id = target.product_id;
end;
$$;

-- The money goes back to the number on the customer's latest proof, as for a
-- rejected order.
create function public.refund_unsupplied_order(
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
  if target.status <> 'paid' then
    raise exception 'Order % is %, not paid', p_order_id, target.status using errcode = 'KJ006';
  end if;
  if not exists (select 1 from public.supply_failures f where f.order_id = p_order_id) then
    raise exception 'Order % is not recorded as unsuppliable', p_order_id using errcode = 'KJ008';
  end if;

  select p.sender_number into paid_from
    from public.payments p
    where p.order_id = p_order_id
    order by p.created_at desc
    limit 1;
  if paid_from is null then
    raise exception 'Order % has no payment to refund to', p_order_id using errcode = 'KJ007';
  end if;

  insert into public.refunds (order_id, customer_id, amount, method, reference, sent_to)
  values (p_order_id, target.customer_id, p_amount, p_method, trim(p_reference), paid_from);

  update public.orders set status = 'refunded' where id = p_order_id;
end;
$$;

revoke execute on function public.mark_order_bought(uuid, text, integer) from public, anon;
grant execute on function public.mark_order_bought(uuid, text, integer) to authenticated;

revoke execute on function public.record_cannot_supply(uuid) from public, anon;
grant execute on function public.record_cannot_supply(uuid) to authenticated;

revoke execute on function public.refund_unsupplied_order(uuid, integer, public.payment_method, text)
  from public, anon;
grant execute on function public.refund_unsupplied_order(uuid, integer, public.payment_method, text)
  to authenticated;


-- ───────────────────────────── Live updates ─────────────────────────────

-- "Can't supply" moves an order between the admin's two lists without
-- changing its status, so the lists listen for these too.
alter publication supabase_realtime add table public.supply_failures;
