-- Phase 2: the data the store runs on, and the policies that decide who reads it.

-- Helpers the policies and triggers use live outside the API-exposed schema,
-- so none of them can be called from a browser as an RPC.
create schema private;
grant usage on schema private to anon, authenticated;


-- ───────────────────────────── RLS on by default ─────────────────────────────
-- The project was created with an `ensure_rls` trigger that existed only in the
-- database and logged-then-ignored any failure. This one is owned by the files
-- and lets a failure abort the CREATE TABLE: a table that can't get RLS must
-- not exist at all. Supabase's own schemas are left to Supabase.

drop event trigger if exists ensure_rls;
drop function if exists public.rls_auto_enable();

create function private.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cmd record;
begin
  for cmd in
    select object_identity, schema_name
    from pg_catalog.pg_event_trigger_ddl_commands()
    where object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name in (
         'pg_catalog', 'information_schema', 'auth', 'storage', 'realtime',
         '_realtime', 'extensions', 'graphql', 'graphql_public', 'vault',
         'pgbouncer', 'net', 'cron', 'supabase_functions', 'supabase_migrations',
         '_analytics', 'pgsodium', 'pgsodium_masks', 'pgmq'
       )
       or cmd.schema_name like 'pg\_toast%'
       or cmd.schema_name like 'pg\_temp%' then
      continue;
    end if;
    execute format('alter table %s enable row level security', cmd.object_identity);
  end loop;
end;
$$;

create event trigger ensure_rls
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function private.rls_auto_enable();

-- Every table below gets RLS from the trigger above, which is why none of them
-- says `enable row level security`. The RLS check proves it.


-- ───────────────────────────── Identity ─────────────────────────────

-- Clerk user IDs are text like `user_2abc…`, never database-generated. A domain
-- catches a UUID or an email pasted where a Clerk ID belongs.
create domain public.clerk_user_id as text
  check (value ~ '^user_[A-Za-z0-9]+$');

-- The signed-in user's Clerk ID, read off the session token. Null when signed
-- out, and null when SQL is run directly on the database (seed, SQL editor).
create function private.requesting_user_id()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'sub', '')
$$;

-- Admin power is a row here. There is no write policy: the first admin is
-- added by hand in SQL, and the app can never make anyone an admin.
create table public.admins (
  clerk_user_id public.clerk_user_id primary key,
  created_at timestamptz not null default now()
);

-- Security definer so the policies can read admins without recursing into
-- admins' own policy.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins
    where clerk_user_id = private.requesting_user_id()
  )
$$;

create table public.customer_profiles (
  clerk_user_id public.clerk_user_id primary key,
  name text,
  whatsapp text,
  created_at timestamptz not null default now()
);


-- ───────────────────────────── Catalogue ─────────────────────────────

-- New products start inactive so nothing reaches the storefront by accident.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Duration is in days: one unit the expiry and warranty sums can share.
-- sell_price is derived (see below). Null means the plan has no supplier
-- details yet, so it has no price and can't be shown or ordered.
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  duration_days integer not null check (duration_days > 0),
  warranty_days integer not null check (warranty_days >= 0),
  sell_price integer check (sell_price > 0),
  created_at timestamptz not null default now()
);
create index plans_product_id_idx on public.plans (product_id);

-- Admin-only, in its own table so a `select *` on plans can never carry it.
create table public.plan_supplier_details (
  plan_id uuid primary key references public.plans (id) on delete cascade,
  supplier_price integer not null check (supplier_price > 0),
  margin integer not null check (margin >= 0),
  numastore_url text not null check (numastore_url ~ '^https://'),
  price_checked_at timestamptz not null default now()
);

-- A plan's sell price is always supplier price + margin. Whatever is written to
-- plans.sell_price is thrown away and recomputed, so it can't be typed.
create function private.plans_set_sell_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.sell_price := (
    select d.supplier_price + d.margin
    from public.plan_supplier_details d
    where d.plan_id = new.id
  );
  return new;
end;
$$;

create trigger plans_set_sell_price
  before insert or update on public.plans
  for each row execute function private.plans_set_sell_price();

-- When the supplier price or margin changes, touch the plan so the trigger
-- above recomputes its sell price.
create function private.plan_supplier_details_touch_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    update public.plans set sell_price = null where id = old.plan_id;
  end if;
  if tg_op <> 'DELETE' then
    update public.plans set sell_price = null where id = new.plan_id;
  end if;
  return null;
end;
$$;

create trigger plan_supplier_details_touch_plan
  after insert or update or delete on public.plan_supplier_details
  for each row execute function private.plan_supplier_details_touch_plan();


-- ───────────────────────────── Payment accounts ─────────────────────────────

create type public.payment_method as enum (
  'easypaisa', 'jazzcash', 'nayapay', 'sadapay', 'bank_transfer'
);

-- The seller's own accounts, shown at checkout.
create table public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  method public.payment_method not null,
  account_title text not null check (length(trim(account_title)) > 0),
  account_number text not null check (length(trim(account_number)) > 0),
  bank_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((method = 'bank_transfer') = (bank_name is not null))
);


-- ───────────────────────────── Orders ─────────────────────────────

create type public.order_status as enum (
  'awaiting_payment', 'verifying', 'paid', 'bought', 'delivered',
  'rejected', 'refunded', 'replaced'
);

-- The only moves an order can make, as the project doc lists them. Expiry is
-- not a state: it's worked out when an order is read.
create table public.order_status_moves (
  from_status public.order_status not null,
  to_status public.order_status not null,
  primary key (from_status, to_status)
);

insert into public.order_status_moves (from_status, to_status) values
  ('awaiting_payment', 'verifying'),
  ('verifying',        'paid'),
  ('verifying',        'rejected'),
  ('rejected',         'paid'),      -- the money turned up after all
  ('rejected',         'refunded'),  -- money arrived but the order can't go ahead
  ('paid',             'bought'),
  ('paid',             'refunded'),  -- numastore out of stock or can't supply
  ('bought',           'delivered'),
  ('delivered',        'replaced'),  -- warranty
  ('delivered',        'refunded');  -- warranty

-- price, product_name, duration_days and warranty_days are copied from the
-- plan when the order is placed, so the order keeps the terms it was sold on.
-- (id, customer_id) is unique so child rows can carry the customer ID and the
-- database guarantees it's the same customer as the order's.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 1001) unique,
  customer_id public.clerk_user_id not null
    references public.customer_profiles (clerk_user_id),
  plan_id uuid not null references public.plans (id),
  status public.order_status not null default 'awaiting_payment',
  price integer not null check (price > 0),
  product_name text not null,
  duration_days integer not null,
  warranty_days integer not null,
  created_at timestamptz not null default now(),
  unique (id, customer_id)
);
create index orders_customer_id_idx on public.orders (customer_id);
create index orders_status_idx on public.orders (status);

-- receipt_path is nullable until the receipts bucket exists (checkout phase).
-- A transaction ID can be used once per payment method.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  customer_id public.clerk_user_id not null,
  method public.payment_method not null,
  transaction_id text not null check (length(trim(transaction_id)) > 0),
  sender_number text not null check (length(trim(sender_number)) > 0),
  receipt_path text,
  created_at timestamptz not null default now(),
  foreign key (order_id, customer_id) references public.orders (id, customer_id),
  unique (method, transaction_id)
);
create index payments_order_id_idx on public.payments (order_id);
create index payments_customer_id_idx on public.payments (customer_id);

-- Admin-only. amount_paid is what the seller really paid, which can differ from
-- the plan's supplier price. One supplier order number, one Kunji order.
create table public.supplier_purchases (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  supplier_name text not null default 'numastore'
    check (length(trim(supplier_name)) > 0),
  supplier_order_number text not null
    check (length(trim(supplier_order_number)) > 0),
  amount_paid integer not null check (amount_paid > 0),
  created_at timestamptz not null default now(),
  unique (supplier_name, supplier_order_number)
);
create index supplier_purchases_order_id_idx on public.supplier_purchases (order_id);

-- Written only by the trigger on orders. from_status is null for the event of
-- the order being placed. actor_id is null when the move was made directly on
-- the database rather than by a signed-in user.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null,
  customer_id public.clerk_user_id not null,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id public.clerk_user_id,
  created_at timestamptz not null default now(),
  foreign key (order_id, customer_id) references public.orders (id, customer_id)
);
create index order_events_order_id_idx on public.order_events (order_id);
create index order_events_customer_id_idx on public.order_events (customer_id);

-- Placing an order: it starts awaiting payment, and its price and terms come
-- from the plan in the database, never from whoever inserted the row.
create function private.orders_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen record;
begin
  if new.status <> 'awaiting_payment' then
    raise exception 'A new order starts at awaiting_payment, not %', new.status
      using errcode = 'check_violation';
  end if;

  select pl.sell_price, pl.duration_days, pl.warranty_days, pr.name
    into chosen
    from public.plans pl
    join public.products pr on pr.id = pl.product_id
    where pl.id = new.plan_id;

  if chosen.sell_price is null then
    raise exception 'Plan % has no price and cannot be ordered', new.plan_id
      using errcode = 'check_violation';
  end if;

  new.price := chosen.sell_price;
  new.product_name := chosen.name;
  new.duration_days := chosen.duration_days;
  new.warranty_days := chosen.warranty_days;
  return new;
end;
$$;

create trigger orders_before_insert
  before insert on public.orders
  for each row execute function private.orders_before_insert();

-- The one place an order's status changes. Any move not in order_status_moves
-- fails, and so does a move whose evidence isn't recorded yet.
create function private.orders_before_update()
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

create trigger orders_before_update
  before update on public.orders
  for each row execute function private.orders_before_update();

create function private.orders_record_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_events (order_id, customer_id, from_status, to_status, actor_id)
  values (
    new.id,
    new.customer_id,
    case when tg_op = 'UPDATE' then old.status end,
    new.status,
    private.requesting_user_id()
  );
  return null;
end;
$$;

create trigger orders_record_placed
  after insert on public.orders
  for each row execute function private.orders_record_event();

create trigger orders_record_move
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function private.orders_record_event();


-- ───────────────────────────── Policies ─────────────────────────────
-- Functions are wrapped in (select …) so Postgres evaluates them once per
-- query, not once per row.

-- admins: an admin can see who the admins are. No writes through the API.
create policy "admins read admins" on public.admins
  for select to authenticated
  using ((select private.is_admin()));

-- customer_profiles: your own, or all of them if you're an admin.
create policy "read own profile or admin" on public.customer_profiles
  for select to authenticated
  using (clerk_user_id = (select private.requesting_user_id()) or (select private.is_admin()));
create policy "admin inserts profiles" on public.customer_profiles
  for insert to authenticated with check ((select private.is_admin()));
create policy "admin updates profiles" on public.customer_profiles
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- products: active ones are public.
create policy "read active products or admin" on public.products
  for select to anon, authenticated
  using (active or (select private.is_admin()));
create policy "admin inserts products" on public.products
  for insert to authenticated with check ((select private.is_admin()));
create policy "admin updates products" on public.products
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin deletes products" on public.products
  for delete to authenticated using ((select private.is_admin()));

-- plans: public when the product is active and the plan has a price.
create policy "read plans of active products or admin" on public.plans
  for select to anon, authenticated
  using (
    (sell_price is not null and exists (
      select 1 from public.products p where p.id = product_id and p.active
    ))
    or (select private.is_admin())
  );
create policy "admin inserts plans" on public.plans
  for insert to authenticated with check ((select private.is_admin()));
create policy "admin updates plans" on public.plans
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin deletes plans" on public.plans
  for delete to authenticated using ((select private.is_admin()));

-- plan_supplier_details: admin only.
create policy "admin reads supplier details" on public.plan_supplier_details
  for select to authenticated using ((select private.is_admin()));
create policy "admin inserts supplier details" on public.plan_supplier_details
  for insert to authenticated with check ((select private.is_admin()));
create policy "admin updates supplier details" on public.plan_supplier_details
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin deletes supplier details" on public.plan_supplier_details
  for delete to authenticated using ((select private.is_admin()));

-- payment_accounts: active ones are public.
create policy "read active payment accounts or admin" on public.payment_accounts
  for select to anon, authenticated
  using (active or (select private.is_admin()));
create policy "admin inserts payment accounts" on public.payment_accounts
  for insert to authenticated with check ((select private.is_admin()));
create policy "admin updates payment accounts" on public.payment_accounts
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin deletes payment accounts" on public.payment_accounts
  for delete to authenticated using ((select private.is_admin()));

-- order_status_moves: admin reads. Changed only by migration.
create policy "admin reads status moves" on public.order_status_moves
  for select to authenticated using ((select private.is_admin()));

-- orders, payments and supplier purchases are history: nobody deletes them
-- through the API.
create policy "read own orders or admin" on public.orders
  for select to authenticated
  using (customer_id = (select private.requesting_user_id()) or (select private.is_admin()));
create policy "admin inserts orders" on public.orders
  for insert to authenticated with check ((select private.is_admin()));
create policy "admin updates orders" on public.orders
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "read own payments or admin" on public.payments
  for select to authenticated
  using (customer_id = (select private.requesting_user_id()) or (select private.is_admin()));
create policy "admin inserts payments" on public.payments
  for insert to authenticated with check ((select private.is_admin()));
create policy "admin updates payments" on public.payments
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "admin reads supplier purchases" on public.supplier_purchases
  for select to authenticated using ((select private.is_admin()));
create policy "admin inserts supplier purchases" on public.supplier_purchases
  for insert to authenticated with check ((select private.is_admin()));
create policy "admin updates supplier purchases" on public.supplier_purchases
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- order_events: read-only for everyone; only the orders trigger writes them.
create policy "read own order events or admin" on public.order_events
  for select to authenticated
  using (customer_id = (select private.requesting_user_id()) or (select private.is_admin()));


-- ───────────────────────────── Admin counts ─────────────────────────────

-- Every state with its count, zeros included. Invoker rights, so the orders
-- policy still applies; the admin check makes a customer get a refusal rather
-- than a misleading count of their own orders.
create function public.order_status_counts()
returns table (order_status public.order_status, order_count bigint)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only an admin can count every order'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select s.status, count(o.id)
    from unnest(enum_range(null::public.order_status)) as s (status)
    left join public.orders o on o.status = s.status
    group by s.status
    order by s.status;
end;
$$;

revoke execute on function public.order_status_counts() from public, anon;
grant execute on function public.order_status_counts() to authenticated;
