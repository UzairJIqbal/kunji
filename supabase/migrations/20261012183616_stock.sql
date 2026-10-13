-- Phase 13: a small stock of best sellers. The seller buys a few logins on
-- numastore in advance; a paid order for a stocked plan takes one and lands
-- in the vault the moment the payment is approved.
--
-- As with the vault, the database never sees a credential in plain text. A
-- stock item is encrypted by the app before any order exists, so it's sealed
-- to the item's own id; the vault entry it becomes says which item it came
-- from, and the app opens it with that id. The ciphertext is never re-sealed,
-- so approval needs nothing from the app and stays one transaction.
--
-- Errors the seller can run into, as before, plus:
--   KJ012  the plan's product needs the customer's activation email, so it
--          can't be stocked


-- ───────────────────────────── Stock ─────────────────────────────

-- One login the seller already bought on numastore. Free while order_id is
-- null; used once an order took it, and never handed out again.
--
-- The fingerprint is a keyed hash of the credential the app works out, so a
-- login added twice is caught without anyone comparing plain text. It's unique
-- across all stock ever added, used or not: a login sold once is never sold
-- again. Like the ciphertext, no API role can read it.
--
-- The numastore order number is stored as purchases store it, and is unique
-- across stock, purchases and replacements (the trigger below).
--
-- expires_at is the day the login stops working, as the seller entered it,
-- at the start of that day in Pakistan.
create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id),
  credential text not null check (
    credential ~ '^v1:([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
    and length(credential) between 43 and 20000
  ),
  fingerprint text not null unique check (fingerprint ~ '^[0-9a-f]{64}$'),
  supplier_order_number text not null unique check (
    length(supplier_order_number) between 1 and 64
    and supplier_order_number = upper(regexp_replace(supplier_order_number, '[[:space:]]', '', 'g'))
  ),
  cost integer not null check (cost > 0),
  expires_at timestamptz not null,
  added_by public.clerk_user_id,
  created_at timestamptz not null default now(),
  order_id uuid unique references public.orders (id),
  used_at timestamptz,
  check ((order_id is null) = (used_at is null)),
  check (expires_at > created_at)
);
create index stock_items_plan_id_idx on public.stock_items (plan_id);

-- What may be sold: a login with at least 90% of the plan's duration left.
-- Anything shorter would sell a "12 month" plan that doesn't last 12 months,
-- so it's held back for the seller to decide. One rule, used by approval, the
-- storefront and the stock page alike.
create function private.stock_sellable(p_expires_at timestamptz, p_duration_days integer)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_expires_at >= now() + (p_duration_days * 0.9) * interval '1 day'
$$;

create policy "admin reads stock" on public.stock_items
  for select to authenticated using ((select private.is_admin()));

-- Added only through add_stock and used only through approve_payment. The
-- ciphertext and fingerprint aren't granted to anyone.
revoke all on public.stock_items from anon, authenticated;
grant select (id, plan_id, supplier_order_number, cost, expires_at, added_by, created_at, order_id, used_at)
  on public.stock_items to authenticated;

-- A numastore order number belongs to one purchase: first, replacement or
-- stock. A stock item's own number turns up again as the purchase of the
-- order that takes it, which is the same purchase, not a second one.
create or replace function private.supplier_order_number_unused()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.supplier_order_number is not null and (
    exists (select 1 from public.supplier_purchases s where s.supplier_order_number = new.supplier_order_number)
    or exists (select 1 from public.replacements r where r.supplier_order_number = new.supplier_order_number)
    or exists (
      select 1 from public.stock_items i
      where i.supplier_order_number = new.supplier_order_number
        and (tg_table_name <> 'supplier_purchases' or i.order_id is distinct from new.order_id)
    )
  ) then
    raise exception 'numastore order % is already recorded', new.supplier_order_number
      using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

create trigger stock_items_supplier_order_number_unused
  before insert on public.stock_items
  for each row execute function private.supplier_order_number_unused();


-- ───────────────────────────── Adding stock ─────────────────────────────

-- The seller's lines, already encrypted and fingerprinted by the app. Each
-- item is {line, credential, fingerprint, supplier_order_number, cost,
-- expires_on}. The good lines are added; each refused one comes back as its
-- line number and why, never anything from the line itself:
--   duplicate    that login is already in stock, or earlier in this paste
--   number_used  that numastore order number is already recorded
create function public.add_stock(p_plan_id uuid, p_items jsonb)
returns table (line integer, problem text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me text := private.requesting_user_id();
  activation boolean;
  item jsonb;
  item_number text;
  item_fingerprint text;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can add stock' using errcode = 'insufficient_privilege';
  end if;

  select pr.needs_activation_email into activation
    from public.plans pl
    join public.products pr on pr.id = pl.product_id
    where pl.id = p_plan_id;
  if not found then
    raise exception 'Plan % was not found', p_plan_id using errcode = 'no_data_found';
  end if;
  -- Bought for one customer's email, so there's nothing to hand over later.
  if activation then
    raise exception 'Plan % is activated on the customer''s email, so it can''t be stocked', p_plan_id
      using errcode = 'KJ012';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Stock items must be a list' using errcode = 'invalid_parameter_value';
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    item_number := upper(regexp_replace(item ->> 'supplier_order_number', '[[:space:]]', '', 'g'));
    item_fingerprint := item ->> 'fingerprint';

    if exists (select 1 from public.stock_items i where i.fingerprint = item_fingerprint) then
      line := (item ->> 'line')::integer;
      problem := 'duplicate';
      return next;
      continue;
    end if;

    begin
      insert into public.stock_items (plan_id, credential, fingerprint, supplier_order_number, cost, expires_at, added_by)
      values (
        p_plan_id,
        item ->> 'credential',
        item_fingerprint,
        item_number,
        (item ->> 'cost')::integer,
        ((item ->> 'expires_on')::date)::timestamp at time zone 'Asia/Karachi',
        me
      );
    exception when unique_violation then
      -- The fingerprint was checked above, so this is the number, or the same
      -- login added from another device in the same moment.
      line := (item ->> 'line')::integer;
      problem := case
        when exists (select 1 from public.stock_items i where i.fingerprint = item_fingerprint) then 'duplicate'
        else 'number_used'
      end;
      return next;
    end;
  end loop;
end;
$$;

revoke execute on function public.add_stock(uuid, jsonb) from public, anon;
grant execute on function public.add_stock(uuid, jsonb) to authenticated;


-- ───────────────────────────── The stock page ─────────────────────────────

-- Each item with whether it's held back now. Invoker rights: only an admin
-- gets rows, through the stock policy.
create view public.stock_item_states
with (security_invoker = true)
as
  select i.id, i.plan_id, i.supplier_order_number, i.cost, i.expires_at, i.created_at,
         i.order_id, i.used_at,
         (i.order_id is null and not private.stock_sellable(i.expires_at, pl.duration_days)) as held_back
  from public.stock_items i
  join public.plans pl on pl.id = i.plan_id;

revoke all on public.stock_item_states from anon, authenticated;
grant select on public.stock_item_states to authenticated;

-- Per stocked plan: free to sell, held back, delivered, and when the free
-- item that runs out first stops working.
create view public.stock_by_plan
with (security_invoker = true)
as
  select s.plan_id,
         count(*) filter (where s.order_id is null and not s.held_back)::integer as free,
         count(*) filter (where s.held_back)::integer as held_back,
         count(*) filter (where s.order_id is not null)::integer as delivered,
         min(s.expires_at) filter (where s.order_id is null and not s.held_back) as soonest_free_expires_at
  from public.stock_item_states s
  group by s.plan_id;

revoke all on public.stock_by_plan from anon, authenticated;
grant select on public.stock_by_plan to authenticated;


-- ───────────────────────────── The storefront ─────────────────────────────

-- Which plans deliver instantly, and the least time left on what a customer
-- would get. No count: the customer is told the delivery is instant and how
-- long it lasts, never how many are left. Security definer because the stock
-- table is admin-only; it returns only these two facts.
create function public.instant_plans(p_plan_ids uuid[])
returns table (plan_id uuid, least_expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.plan_id, min(i.expires_at)
  from public.stock_items i
  join public.plans pl on pl.id = i.plan_id
  join public.products pr on pr.id = pl.product_id
  where i.plan_id = any (p_plan_ids)
    and i.order_id is null
    and private.stock_sellable(i.expires_at, pl.duration_days)
    and pl.sell_price is not null and pr.active and not pr.sold_out
  group by i.plan_id
$$;

revoke execute on function public.instant_plans(uuid[]) from public;
grant execute on function public.instant_plans(uuid[]) to anon, authenticated;


-- ───────────────────────────── The vault ─────────────────────────────

-- Where a stocked login came from, and its real end date. stock_item_id says
-- the ciphertext is sealed to that item rather than to the order; a
-- replacement puts a fresh credential in, sealed to the order, and clears it.
-- expires_at is the item's own end date, so the vault shows when the login
-- really stops working; null means the plan's duration from delivery.
alter table public.vault_entries
  add column stock_item_id uuid unique references public.stock_items (id),
  add column expires_at timestamptz;

grant select (expires_at) on public.vault_entries to authenticated;

-- A replaced credential keeps the seal it was stored with.
alter table public.replaced_credentials
  add column stock_item_id uuid references public.stock_items (id);

create or replace function private.replace_credential(
  p_ticket_id uuid,
  p_order_id uuid,
  p_order_status public.order_status,
  p_source public.replacement_source,
  p_cost integer,
  p_supplier_order_number text,
  p_kind public.credential_kind,
  p_credential text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_replacement uuid;
begin
  insert into public.replacements (ticket_id, order_id, source, cost, supplier_order_number, replaced_by)
  values (p_ticket_id, p_order_id, p_source, p_cost, p_supplier_order_number, private.requesting_user_id())
  returning id into new_replacement;

  insert into public.replaced_credentials (order_id, replacement_id, kind, credential, stock_item_id)
  select v.order_id, new_replacement, v.kind, v.credential, v.stock_item_id
  from public.vault_entries v
  where v.order_id = p_order_id;

  update public.vault_entries
    set kind = p_kind, credential = p_credential, stock_item_id = null
    where order_id = p_order_id;

  update public.warranty_tickets set status = 'replaced', closed_at = now() where id = p_ticket_id;

  if p_order_status <> 'replaced' then
    update public.orders set status = 'replaced' where id = p_order_id;
  end if;
end;
$$;

revoke execute on function private.replace_credential(
  uuid, uuid, public.order_status, public.replacement_source, integer, text, public.credential_kind, text
) from public, anon, authenticated;

-- As before, plus the id the ciphertext is sealed to: the stock item's when
-- it came from stock, otherwise the order's.
drop function public.reveal_credential(uuid);
create function public.reveal_credential(p_order_id uuid)
returns table (kind public.credential_kind, credential text, sealed_to uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me text := private.requesting_user_id();
  entry record;
begin
  if me is null then
    raise exception 'Sign in to see a credential' using errcode = 'insufficient_privilege';
  end if;

  select v.kind, v.credential, v.customer_id, v.stock_item_id, o.status into entry
    from public.vault_entries v
    join public.orders o on o.id = v.order_id
    where v.order_id = p_order_id
      and (v.customer_id = me or private.is_admin());
  -- Someone else's entry is the same as no entry.
  if not found then
    raise exception 'Vault entry % was not found', p_order_id using errcode = 'no_data_found';
  end if;

  if entry.status = 'refunded' and not private.is_admin() then
    raise exception 'Order % was refunded; its credential is no longer shown', p_order_id
      using errcode = 'KJ010';
  end if;

  insert into public.vault_reveals (order_id, customer_id, revealed_by)
  values (p_order_id, entry.customer_id, me);

  return query select entry.kind, entry.credential, coalesce(entry.stock_item_id, p_order_id);
end;
$$;

revoke execute on function public.reveal_credential(uuid) from public, anon;
grant execute on function public.reveal_credential(uuid) to authenticated;

drop function public.reveal_replaced_credential(bigint);
create function public.reveal_replaced_credential(p_replaced_credential_id bigint)
returns table (order_id uuid, kind public.credential_kind, credential text, sealed_to uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me text := private.requesting_user_id();
  entry record;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can see a replaced credential' using errcode = 'insufficient_privilege';
  end if;

  select r.order_id, r.kind, r.credential, r.stock_item_id, v.customer_id into entry
    from public.replaced_credentials r
    join public.vault_entries v on v.order_id = r.order_id
    where r.id = p_replaced_credential_id;
  if not found then
    raise exception 'Replaced credential % was not found', p_replaced_credential_id
      using errcode = 'no_data_found';
  end if;

  insert into public.vault_reveals (order_id, customer_id, revealed_by, replaced_credential_id)
  values (entry.order_id, entry.customer_id, me, p_replaced_credential_id);

  return query select entry.order_id, entry.kind, entry.credential, coalesce(entry.stock_item_id, entry.order_id);
end;
$$;

revoke execute on function public.reveal_replaced_credential(bigint) from public, anon;
grant execute on function public.reveal_replaced_credential(bigint) to authenticated;


-- ───────────────────────────── Approval ─────────────────────────────

-- As before, and when the order's plan has a sellable free login, the same
-- transaction takes it: the order passes through bought, on the item's
-- numastore number and cost, to delivered, and the item is used. Either all
-- of that happens or none of it.
--
-- The item is picked with skip locked: two approvals in the same moment each
-- lock a different item, or the second finds none and its order stays paid,
-- on the buy list. The unique order_id and stock_item_id stand behind that.
--
-- Security definer because no API role can write the vault or read stock;
-- the admin check stands in for the policies, and the order trigger still
-- checks every move and records the approver as its actor.
--
-- Returns whether the order was delivered from stock.
drop function public.approve_payment(uuid);
create function public.approve_payment(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  item record;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can approve a payment' using errcode = 'insufficient_privilege';
  end if;

  select o.status, o.customer_id, o.plan_id, o.duration_days, o.activation_email into target
    from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'Order % was not found', p_order_id using errcode = 'no_data_found';
  end if;
  -- From rejected too: the money can turn up after the seller said it hadn't.
  if target.status not in ('verifying', 'rejected') then
    raise exception 'Order % is %, so there is no payment to approve', p_order_id, target.status
      using errcode = 'KJ006';
  end if;

  update public.orders set status = 'paid' where id = p_order_id;

  -- add_stock refuses activation-email plans; this keeps an order placed with
  -- an email off any stock added before the product changed.
  if target.activation_email is not null then
    return false;
  end if;

  select i.id, i.credential, i.supplier_order_number, i.cost, i.expires_at into item
    from public.stock_items i
    where i.plan_id = target.plan_id
      and i.order_id is null
      and private.stock_sellable(i.expires_at, target.duration_days)
    order by i.expires_at, i.created_at
    limit 1
    for update skip locked;
  if not found then
    return false;
  end if;

  update public.stock_items set order_id = p_order_id, used_at = now() where id = item.id;

  insert into public.supplier_purchases (order_id, supplier_order_number, amount_paid)
  values (p_order_id, item.supplier_order_number, item.cost);
  update public.orders set status = 'bought' where id = p_order_id;

  insert into public.vault_entries (order_id, customer_id, kind, credential, stock_item_id, expires_at)
  values (p_order_id, target.customer_id, 'login', item.credential, item.id, item.expires_at);
  update public.orders set status = 'delivered' where id = p_order_id;

  return true;
end;
$$;

revoke execute on function public.approve_payment(uuid) from public, anon;
grant execute on function public.approve_payment(uuid) to authenticated;
