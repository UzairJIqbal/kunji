-- Phase 5: a customer places an order and submits proof of payment.
--
-- Customers write for the first time here. Each write is a policy on their own
-- rows; the triggers below hold every rule a write must keep however it
-- arrives, so the two functions at the end are conveniences that write several
-- rows together, never the only thing standing between a customer and a rule.
--
-- Errors a customer can cause carry their own SQLSTATE so the app can say what
-- happened without reading the message text:
--   KJ001  three unexpired orders are already awaiting payment
--   KJ002  the plan can't be ordered (hidden, unpriced or sold out)
--   KJ003  the product needs an activation email and none was given
--   KJ004  no WhatsApp number on the profile
--   KJ005  the order isn't awaiting payment, so it takes no proof
-- A reused transaction ID is the unique constraint's own 23505.


-- ───────────────────────────── Profiles ─────────────────────────────

-- Stored as wa.me wants it, so the seller's tap-to-chat link needs no parsing.
alter table public.customer_profiles
  add constraint customer_profiles_whatsapp_check check (whatsapp ~ '^923[0-9]{9}$');

-- A customer's profile is made the first time they check out, by them.
create policy "customer creates own profile" on public.customer_profiles
  for insert to authenticated
  with check (clerk_user_id = (select private.requesting_user_id()));
create policy "customer updates own profile" on public.customer_profiles
  for update to authenticated
  using (clerk_user_id = (select private.requesting_user_id()))
  with check (clerk_user_id = (select private.requesting_user_id()));

-- The ID is who the row belongs to; nobody renames it through the API.
revoke update on public.customer_profiles from authenticated;
grant update (name, whatsapp) on public.customer_profiles to authenticated;


-- ───────────────────────────── Orders ─────────────────────────────

-- Expiry is a time, not a state: whether an order has expired is worked out
-- when it's read, and an expired order still takes proof.
alter table public.orders
  add column activation_email text
    check (length(activation_email) <= 254
           and activation_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  add column expires_at timestamptz;

update public.orders set expires_at = created_at + interval '2 hours' where expires_at is null;
alter table public.orders alter column expires_at set not null;

-- What the open-order limit counts.
create index orders_awaiting_payment_idx on public.orders (customer_id, expires_at)
  where status = 'awaiting_payment';

-- Placing an order: it starts awaiting payment, its price and terms come from
-- the plan in the database, its expiry from the database's clock, and never
-- from whoever inserted the row.
create or replace function private.orders_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen record;
  open_orders integer;
begin
  if new.status <> 'awaiting_payment' then
    raise exception 'A new order starts at awaiting_payment, not %', new.status
      using errcode = 'check_violation';
  end if;

  select pl.sell_price, pl.duration_days, pl.warranty_days,
         pr.name, pr.active, pr.sold_out, pr.needs_activation_email
    into chosen
    from public.plans pl
    join public.products pr on pr.id = pl.product_id
    where pl.id = new.plan_id;

  if not found or chosen.sell_price is null or not chosen.active or chosen.sold_out then
    raise exception 'Plan % cannot be ordered right now', new.plan_id
      using errcode = 'KJ002';
  end if;

  -- Asked for only when the product needs it. Anything sent for a product
  -- that doesn't is dropped, so no order carries an email it wasn't sold with.
  if chosen.needs_activation_email then
    if new.activation_email is null then
      raise exception 'This product needs the email it will be activated on'
        using errcode = 'KJ003';
    end if;
  else
    new.activation_email := null;
  end if;

  -- Locking the profile queues this customer's checkouts one behind another,
  -- so two taps at once can't both slip under the limit.
  perform 1 from public.customer_profiles p
    where p.clerk_user_id = new.customer_id
    for update;

  select count(*) into open_orders
    from public.orders o
    where o.customer_id = new.customer_id
      and o.status = 'awaiting_payment'
      and o.expires_at > now();

  if open_orders >= 3 then
    raise exception 'Customer already has % unexpired orders awaiting payment', open_orders
      using errcode = 'KJ001';
  end if;

  new.price := chosen.sell_price;
  new.product_name := chosen.name;
  new.duration_days := chosen.duration_days;
  new.warranty_days := chosen.warranty_days;
  new.expires_at := now() + interval '2 hours';
  return new;
end;
$$;

-- expires_at isn't held here: no API role may write it (see the grants below),
-- and the seller can still move it by hand in SQL to test expiry.
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

    if new.status = 'bought' and not exists (
      select 1 from public.supplier_purchases s where s.order_id = new.id
    ) then
      raise exception 'Order % has no supplier order number recorded, so it cannot be bought',
        old.number
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- The trigger fixes the price, terms, status and expiry of a new order, so a
-- customer placing their own is safe however the row is sent.
create policy "customer places own order" on public.orders
  for insert to authenticated
  with check (customer_id = (select private.requesting_user_id()));

-- While an order awaits payment its customer may correct the activation email
-- and move it to verifying, and nothing else. Proof has to exist first (the
-- trigger), and once it's verifying the customer can't touch it at all.
create policy "customer updates own unpaid order" on public.orders
  for update to authenticated
  using (
    customer_id = (select private.requesting_user_id())
    and status = 'awaiting_payment'
  )
  with check (
    customer_id = (select private.requesting_user_id())
    and status in ('awaiting_payment', 'verifying')
  );

-- Through the API an order's status and activation email are the only things
-- that ever change after it's placed.
revoke update on public.orders from authenticated;
grant update (status, activation_email) on public.orders to authenticated;


-- ───────────────────────────── Receipts ─────────────────────────────

-- Private: no URL serves these without a token the policies accept. Phone
-- screenshots, so images only, and small enough for mobile data.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Each customer uploads into a folder named by their Clerk ID, and that folder
-- is theirs. No update policy: a receipt is never overwritten.
create policy "customer reads own receipts or admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and ((storage.foldername(name))[1] = (select private.requesting_user_id())
         or (select private.is_admin()))
  );
create policy "customer uploads own receipts" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select private.requesting_user_id())
  );
-- A receipt no payment names is one whose proof was refused (a reused
-- transaction ID, say). Its uploader may take it back; once a payment names
-- it, it's evidence and stays.
create policy "customer removes own unused receipts" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select private.requesting_user_id())
    and not exists (select 1 from public.payments p where p.receipt_path = objects.name)
  );


-- ───────────────────────────── Payments ─────────────────────────────

-- Which of the seller's accounts the customer says they paid into. The method
-- is copied from that account, so the two can't disagree.
alter table public.payments
  add column payment_account_id uuid references public.payment_accounts (id);
create index payments_payment_account_id_idx on public.payments (payment_account_id);

-- The only payments that can exist before this migration are Phase 2's
-- labelled test seed: no receipt, and the seed's one Easypaisa account. On a
-- database built from scratch the table is empty here and this does nothing.
-- If a seed payment has no account of its method, set not null below fails
-- and the migration stops rather than guessing.
update public.payments p
set payment_account_id = (
      select a.id from public.payment_accounts a
      where a.method = p.method
      order by a.created_at
      limit 1
    ),
    receipt_path = p.customer_id || '/' || gen_random_uuid() || '.png'
where p.payment_account_id is null;

-- A receipt lives in its customer's own folder. Transaction IDs are stored
-- with spaces gone and in capitals, so "ab 12" and "AB12" are the same ID to
-- the unique constraint.
alter table public.payments
  alter column payment_account_id set not null,
  alter column receipt_path set not null,
  add constraint payments_receipt_path_key unique (receipt_path),
  add constraint payments_receipt_path_check
    check (receipt_path ~ ('^' || customer_id || '/[0-9a-f-]{36}\.(jpg|png|webp)$')),
  add constraint payments_transaction_id_normalised_check
    check (transaction_id = upper(regexp_replace(transaction_id, '[[:space:]]', '', 'g'))
           and length(transaction_id) <= 64),
  add constraint payments_sender_number_length_check
    check (length(sender_number) <= 34);

create function private.payments_set_method()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.method := (
    select a.method from public.payment_accounts a where a.id = new.payment_account_id
  );
  return new;
end;
$$;

create trigger payments_set_method
  before insert or update of payment_account_id, method on public.payments
  for each row execute function private.payments_set_method();

-- A customer records proof for their own order, only while it awaits payment,
-- and only with a receipt they've already uploaded. The order's composite
-- foreign key makes sure the order is theirs. An account switched off after
-- they paid into it is still accepted: switching off never refuses money.
create policy "customer records proof for own unpaid order" on public.payments
  for insert to authenticated
  with check (
    customer_id = (select private.requesting_user_id())
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.status = 'awaiting_payment'
    )
    and exists (
      select 1 from storage.objects s
      where s.bucket_id = 'receipts' and s.name = receipt_path
    )
  );


-- ───────────────────────────── Checkout functions ─────────────────────────────

-- The browser says which plan; the price is read here, by the order trigger.
-- Saves the WhatsApp number on the profile (making the profile on a first
-- order) and places the order, together or not at all. Invoker rights: the
-- policies above decide, exactly as for direct writes.
create function public.place_order(
  p_plan_id uuid,
  p_activation_email text default null,
  p_whatsapp text default null
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me text := private.requesting_user_id();
  placed bigint;
begin
  if me is null then
    raise exception 'Sign in to place an order' using errcode = 'insufficient_privilege';
  end if;

  if p_whatsapp is null then
    insert into public.customer_profiles (clerk_user_id) values (me)
    on conflict (clerk_user_id) do nothing;
  else
    insert into public.customer_profiles (clerk_user_id, whatsapp) values (me, p_whatsapp)
    on conflict (clerk_user_id) do update set whatsapp = excluded.whatsapp;
  end if;

  if not exists (
    select 1 from public.customer_profiles p
    where p.clerk_user_id = me and p.whatsapp is not null
  ) then
    raise exception 'A WhatsApp number is needed to place an order' using errcode = 'KJ004';
  end if;

  insert into public.orders (customer_id, plan_id, activation_email)
  values (me, p_plan_id, p_activation_email)
  returning number into placed;

  return placed;
end;
$$;

-- Records the proof and moves the order to verifying, together or not at all.
-- Never further: only the seller moves an order to paid.
create function public.submit_payment_proof(
  p_order_id uuid,
  p_payment_account_id uuid,
  p_transaction_id text,
  p_sender_number text,
  p_receipt_path text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target record;
begin
  -- Locked, so a double tap waits for the first submission and then finds
  -- the order already verifying. A lock only reaches rows the update policy
  -- lets this caller change, so a miss is told apart with a plain read.
  select o.customer_id, o.status into target
    from public.orders o
    where o.id = p_order_id
    for update;

  if not found then
    select o.customer_id, o.status into target
      from public.orders o
      where o.id = p_order_id;
  end if;
  if not found then
    raise exception 'Order % was not found', p_order_id using errcode = 'no_data_found';
  end if;
  if target.status <> 'awaiting_payment' then
    raise exception 'Order % is %, so it takes no proof', p_order_id, target.status
      using errcode = 'KJ005';
  end if;

  insert into public.payments
    (order_id, customer_id, payment_account_id, transaction_id, sender_number, receipt_path)
  values
    (p_order_id, target.customer_id, p_payment_account_id, p_transaction_id,
     p_sender_number, p_receipt_path);

  update public.orders set status = 'verifying' where id = p_order_id;
end;
$$;

revoke execute on function public.place_order(uuid, text, text) from public, anon;
grant execute on function public.place_order(uuid, text, text) to authenticated;

revoke execute on function public.submit_payment_proof(uuid, uuid, text, text, text)
  from public, anon;
grant execute on function public.submit_payment_proof(uuid, uuid, text, text, text)
  to authenticated;
