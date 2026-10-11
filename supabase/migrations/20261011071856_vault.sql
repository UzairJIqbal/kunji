-- Phase 8: the credentials the seller got from numastore go into the
-- customer's vault, encrypted, revealed on a tap, every reveal recorded.
--
-- The database never sees a credential in plain text. The app encrypts it
-- with a key only the server's environment holds, and stores the result here;
-- this file only keeps it, hands it out through a recorded reveal, and refuses
-- anything that doesn't look like ciphertext.
--
-- Errors the seller can run into, as before:
--   KJ006  the order isn't bought, so there is nothing to deliver


-- ───────────────────────────── Products ─────────────────────────────

-- What voids the warranty, in the seller's words for each product ("don't
-- change the password, email, phone or 2FA"). Blank means the seller hasn't
-- written one, and the vault shows nothing in its place.
alter table public.products
  add column warranty_warning text not null default '';


-- ───────────────────────────── Vault entries ─────────────────────────────

-- What numastore delivered: a login and password, a licence key, or a note
-- that an invite went to the customer's activation email. The kind is shown
-- in the list, so it's plain; what was delivered is in the ciphertext.
create type public.credential_kind as enum ('login', 'licence_key', 'invite');

-- One per delivered order. The credential column holds the app's ciphertext
-- format ("v1:" then base64 of IV, tag and ciphertext, at least one byte of
-- it), so a password pasted straight into the table is refused rather than
-- stored readable.
--
-- The setup instructions and warranty warning are copied from the product at
-- delivery, as an order copies its price: the customer's warranty is judged
-- by the warning they were shown, and hiding the product later doesn't blank
-- the vault. Expiry and warranty end are worked out from delivered_at when
-- read; warranty runs from here, as numastore's runs from its own delivery.
create table public.vault_entries (
  order_id uuid primary key,
  customer_id public.clerk_user_id not null,
  kind public.credential_kind not null,
  credential text not null
    check (credential ~ '^v1:[A-Za-z0-9+/]{40,}={0,2}$' and length(credential) <= 20000),
  setup_instructions text not null,
  warranty_warning text not null,
  delivered_at timestamptz not null default now(),
  delivered_by public.clerk_user_id,
  foreign key (order_id, customer_id) references public.orders (id, customer_id)
);
create index vault_entries_customer_id_idx on public.vault_entries (customer_id);

-- Who delivered, when, and what the product said: the database's, never the
-- request's. delivered_by is null only when written directly on the database.
create function private.vault_entries_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select pr.setup_instructions, pr.warranty_warning
    into new.setup_instructions, new.warranty_warning
    from public.orders o
    join public.plans pl on pl.id = o.plan_id
    join public.products pr on pr.id = pl.product_id
    where o.id = new.order_id;
  new.delivered_by := private.requesting_user_id();
  new.delivered_at := now();
  return new;
end;
$$;

create trigger vault_entries_before_insert
  before insert on public.vault_entries
  for each row execute function private.vault_entries_before_insert();


-- ───────────────────────────── Reveals ─────────────────────────────

-- Every time anyone sees a credential: who and when. Written only by
-- reveal_credential below, which is the only way to the ciphertext.
create table public.vault_reveals (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.vault_entries (order_id),
  customer_id public.clerk_user_id not null,
  revealed_by public.clerk_user_id not null,
  created_at timestamptz not null default now(),
  foreign key (order_id, customer_id) references public.orders (id, customer_id)
);
create index vault_reveals_order_id_idx on public.vault_reveals (order_id);
create index vault_reveals_customer_id_idx on public.vault_reveals (customer_id);


-- ───────────────────────────── Status moves ─────────────────────────────

-- As before, plus: delivered needs the credential in the vault. Delivered is
-- reached only from bought (order_status_moves), so a delivered order always
-- has a numastore order number and a vault entry behind it.
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

    if new.status = 'delivered' and not exists (
      select 1 from public.vault_entries v where v.order_id = new.id
    ) then
      raise exception 'Order % has nothing in the vault, so it cannot be delivered',
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


-- ───────────────────────────── Policies ─────────────────────────────

create policy "read own vault entries or admin" on public.vault_entries
  for select to authenticated
  using (customer_id = (select private.requesting_user_id()) or (select private.is_admin()));
create policy "admin delivers to vaults" on public.vault_entries
  for insert to authenticated with check ((select private.is_admin()));

create policy "read own vault reveals or admin" on public.vault_reveals
  for select to authenticated
  using (customer_id = (select private.requesting_user_id()) or (select private.is_admin()));

-- The credential column is readable by no API role, admin or owner: the vault
-- list never carries it, and the only way to it is reveal_credential, which
-- records the reveal first. Entries and reveals are history: never changed or
-- removed through the API.
revoke all on public.vault_entries, public.vault_reveals from anon, authenticated;
grant select (order_id, customer_id, kind, setup_instructions, warranty_warning, delivered_at, delivered_by)
  on public.vault_entries to authenticated;
grant insert (order_id, customer_id, kind, credential) on public.vault_entries to authenticated;
grant select on public.vault_reveals to authenticated;


-- ───────────────────────────── Delivering ─────────────────────────────

-- The seller pasted what numastore delivered; the app has already encrypted
-- it. The entry and the move to delivered happen together or not at all. As
-- with buying: admin check, the order locked so two devices queue up, every
-- write left to the policies (invoker rights).
create function public.deliver_order(
  p_order_id uuid,
  p_kind public.credential_kind,
  p_credential text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target record;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can deliver an order' using errcode = 'insufficient_privilege';
  end if;

  select o.status, o.customer_id into target from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'Order % was not found', p_order_id using errcode = 'no_data_found';
  end if;
  if target.status <> 'bought' then
    raise exception 'Order % is %, so there is nothing to deliver', p_order_id, target.status
      using errcode = 'KJ006';
  end if;

  insert into public.vault_entries (order_id, customer_id, kind, credential)
  values (p_order_id, target.customer_id, p_kind, p_credential);

  update public.orders set status = 'delivered' where id = p_order_id;
end;
$$;


-- ───────────────────────────── Revealing ─────────────────────────────

-- Hands back the ciphertext for the app to decrypt, and records who asked.
-- Security definer because the column is closed to every API role, so a
-- reveal can't happen without its record. Who may reveal is the same rule as
-- the vault_entries read policy: the entry's own customer, or an admin.
create function public.reveal_credential(p_order_id uuid)
returns table (kind public.credential_kind, credential text)
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

  select v.kind, v.credential, v.customer_id into entry
    from public.vault_entries v
    where v.order_id = p_order_id
      and (v.customer_id = me or private.is_admin());
  -- Someone else's entry is the same as no entry.
  if not found then
    raise exception 'Vault entry % was not found', p_order_id using errcode = 'no_data_found';
  end if;

  insert into public.vault_reveals (order_id, customer_id, revealed_by)
  values (p_order_id, entry.customer_id, me);

  return query select entry.kind, entry.credential;
end;
$$;

revoke execute on function public.deliver_order(uuid, public.credential_kind, text) from public, anon;
grant execute on function public.deliver_order(uuid, public.credential_kind, text) to authenticated;

revoke execute on function public.reveal_credential(uuid) from public, anon;
grant execute on function public.reveal_credential(uuid) to authenticated;

-- Not added to the realtime publication: a delivery is heard as the order's
-- move to delivered, so the ciphertext never travels over a socket.
