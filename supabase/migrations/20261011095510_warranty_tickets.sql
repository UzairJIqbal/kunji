-- Phase 9: warranty tickets. A customer reports a broken subscription while
-- its warranty runs; the seller claims it with numastore, then replaces the
-- credential or refunds the unused share.
--
-- Errors the customer or seller can run into, as before:
--   KJ006  the order or ticket isn't in a state this applies to
--   KJ007  the order has no payment to refund to
--   KJ009  the order's warranty has ended
-- A second open ticket on one order is the unique index's own 23505, as is a
-- numastore order number already used on any order.


-- ───────────────────────────── Tickets ─────────────────────────────

create type public.ticket_reason as enum ('login_failed', 'ended_early', 'other');

-- Open until claimed or closed; closed says how, so the customer's side can
-- say what happened without reading anything about the supplier.
create type public.ticket_status as enum ('open', 'claimed', 'replaced', 'refunded');

-- The note is the customer's own words; "other" means nothing without one.
-- The screenshot is a path in the ticket-screenshots bucket, inside the
-- customer's own folder.
create table public.warranty_tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  customer_id public.clerk_user_id not null,
  reason public.ticket_reason not null,
  note text not null default '' check (length(note) <= 2000),
  screenshot_path text check (length(screenshot_path) <= 200),
  status public.ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  foreign key (order_id, customer_id) references public.orders (id, customer_id),
  check (reason <> 'other' or length(trim(note)) > 0),
  check ((status in ('open', 'claimed')) = (closed_at is null))
);
create index warranty_tickets_customer_id_idx on public.warranty_tickets (customer_id);
create index warranty_tickets_order_id_idx on public.warranty_tickets (order_id);

-- One open ticket per order.
create unique index warranty_tickets_one_open_idx
  on public.warranty_tickets (order_id) where status in ('open', 'claimed');

-- The warranty is judged here, however the row is written: a direct insert
-- on an order past its warranty is refused as surely as one from the app.
-- Warranty runs from the vault entry's delivered_at, which a replacement
-- never changes. Security definer to read the vault entry and order whatever
-- the caller's grants; the status and times are the database's.
create function private.warranty_tickets_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
begin
  select o.number, o.status, o.warranty_days, v.delivered_at into target
    from public.orders o
    left join public.vault_entries v on v.order_id = o.id
    where o.id = new.order_id;
  if not found or target.status not in ('delivered', 'replaced') or target.delivered_at is null then
    raise exception 'Order % is not delivered, so it has no warranty to claim', target.number
      using errcode = 'KJ006';
  end if;
  if now() >= target.delivered_at + make_interval(days => target.warranty_days) then
    raise exception 'Order %''s warranty has ended', target.number using errcode = 'KJ009';
  end if;
  if new.screenshot_path is not null
     and split_part(new.screenshot_path, '/', 1) is distinct from new.customer_id then
    raise exception 'A ticket''s screenshot is in its customer''s own folder'
      using errcode = 'check_violation';
  end if;

  new.status := 'open';
  new.created_at := now();
  new.closed_at := null;
  return new;
end;
$$;

create trigger warranty_tickets_before_insert
  before insert on public.warranty_tickets
  for each row execute function private.warranty_tickets_before_insert();

create policy "read own tickets or admin" on public.warranty_tickets
  for select to authenticated
  using (customer_id = (select private.requesting_user_id()) or (select private.is_admin()));
create policy "customer opens tickets on own orders" on public.warranty_tickets
  for insert to authenticated
  with check (customer_id = (select private.requesting_user_id()));

-- A ticket's status moves only through the functions below.
revoke all on public.warranty_tickets from anon, authenticated;
grant select on public.warranty_tickets to authenticated;
grant insert (order_id, customer_id, reason, note, screenshot_path) on public.warranty_tickets to authenticated;


-- ───────────────────────────── Messages ─────────────────────────────

-- Either side of a ticket. Who wrote it is the database's; from_seller is
-- whether that was someone other than the customer, which only an admin can
-- be (the insert policy).
create table public.ticket_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.warranty_tickets (id),
  customer_id public.clerk_user_id not null,
  author_id public.clerk_user_id,
  from_seller boolean not null default false,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index ticket_messages_ticket_id_idx on public.ticket_messages (ticket_id, created_at);
create index ticket_messages_customer_id_idx on public.ticket_messages (customer_id);

-- The thread is for the ticket while it's open; once closed, the WhatsApp
-- link is the way to talk.
create function private.ticket_messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket record;
begin
  select t.customer_id, t.status into ticket from public.warranty_tickets t where t.id = new.ticket_id;
  if not found or ticket.customer_id is distinct from new.customer_id then
    raise exception 'Ticket % was not found', new.ticket_id using errcode = 'no_data_found';
  end if;
  if ticket.status not in ('open', 'claimed') then
    raise exception 'Ticket % is closed', new.ticket_id using errcode = 'KJ006';
  end if;

  new.author_id := private.requesting_user_id();
  new.from_seller := new.author_id is distinct from new.customer_id;
  new.created_at := now();
  return new;
end;
$$;

create trigger ticket_messages_before_insert
  before insert on public.ticket_messages
  for each row execute function private.ticket_messages_before_insert();

create policy "read own ticket messages or admin" on public.ticket_messages
  for select to authenticated
  using (customer_id = (select private.requesting_user_id()) or (select private.is_admin()));
create policy "customer or admin writes ticket messages" on public.ticket_messages
  for insert to authenticated
  with check (customer_id = (select private.requesting_user_id()) or (select private.is_admin()));

revoke all on public.ticket_messages from anon, authenticated;
grant select on public.ticket_messages to authenticated;
grant insert (ticket_id, customer_id, body) on public.ticket_messages to authenticated;


-- ───────────────────────────── Claims ─────────────────────────────

-- The numastore support ticket the seller raised. Admin only: the customer
-- sees only that the ticket is claimed.
create table public.ticket_claims (
  ticket_id uuid primary key references public.warranty_tickets (id),
  order_id uuid not null references public.orders (id),
  supplier_reference text not null check (length(supplier_reference) between 1 and 64),
  claimed_by public.clerk_user_id,
  created_at timestamptz not null default now()
);
create index ticket_claims_order_id_idx on public.ticket_claims (order_id);

create policy "admin reads ticket claims" on public.ticket_claims
  for select to authenticated using ((select private.is_admin()));

revoke all on public.ticket_claims from anon, authenticated;
grant select on public.ticket_claims to authenticated;


-- ───────────────────────────── Replacements ─────────────────────────────

-- What closing a ticket with a new credential cost the seller: nothing when
-- numastore covered the claim, the real amount and the new numastore order
-- number when the seller bought a fresh one. Admin only: it's supplier detail.
create type public.replacement_source as enum ('claim', 'purchase');

create table public.replacements (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.warranty_tickets (id),
  order_id uuid not null references public.orders (id),
  source public.replacement_source not null,
  cost integer not null check (cost >= 0),
  supplier_order_number text
    check (supplier_order_number = upper(regexp_replace(supplier_order_number, '[[:space:]]', '', 'g'))
           and length(supplier_order_number) between 1 and 64),
  replaced_by public.clerk_user_id,
  created_at timestamptz not null default now(),
  unique (supplier_order_number),
  check (
    (source = 'claim' and cost = 0 and supplier_order_number is null)
    or (source = 'purchase' and cost > 0 and supplier_order_number is not null)
  )
);
create index replacements_order_id_idx on public.replacements (order_id);

-- A numastore order number belongs to one purchase, first or replacement.
-- Each table's unique constraint covers itself; this covers the pair.
create function private.supplier_order_number_unused()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.supplier_order_number is not null and (
    exists (select 1 from public.supplier_purchases s where s.supplier_order_number = new.supplier_order_number)
    or exists (select 1 from public.replacements r where r.supplier_order_number = new.supplier_order_number)
  ) then
    raise exception 'numastore order % is already recorded', new.supplier_order_number
      using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

create trigger replacements_supplier_order_number_unused
  before insert on public.replacements
  for each row execute function private.supplier_order_number_unused();
create trigger supplier_purchases_supplier_order_number_unused
  before insert on public.supplier_purchases
  for each row execute function private.supplier_order_number_unused();

create policy "admin reads replacements" on public.replacements
  for select to authenticated using ((select private.is_admin()));

revoke all on public.replacements from anon, authenticated;
grant select on public.replacements to authenticated;


-- ───────────────────────────── Replaced credentials ─────────────────────────────

-- The credential a replacement took out of the vault, kept as it was stored:
-- the same ciphertext, still sealed to its order. Readable by an admin, never
-- the customer, and like the vault the ciphertext only through a recorded
-- reveal.
create table public.replaced_credentials (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.vault_entries (order_id),
  replacement_id uuid not null unique references public.replacements (id),
  kind public.credential_kind not null,
  credential text not null
    check (credential ~ '^v1:[A-Za-z0-9+/]{40,}={0,2}$' and length(credential) <= 20000),
  replaced_at timestamptz not null default now()
);
create index replaced_credentials_order_id_idx on public.replaced_credentials (order_id);

create policy "admin reads replaced credentials" on public.replaced_credentials
  for select to authenticated using ((select private.is_admin()));

revoke all on public.replaced_credentials from anon, authenticated;
grant select (id, order_id, replacement_id, kind, replaced_at) on public.replaced_credentials to authenticated;

-- A reveal of a replaced credential is recorded beside the vault's own.
alter table public.vault_reveals
  add column replaced_credential_id bigint references public.replaced_credentials (id);


-- ───────────────────────────── Status moves ─────────────────────────────

-- A replaced order can go back to the seller and end in a refund.
-- Replacing it again keeps it at replaced.
insert into public.order_status_moves (from_status, to_status) values
  ('replaced', 'refunded');

-- As before, plus: a delivered or replaced order is replaced or refunded only
-- through a ticket closed that way.
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

    if new.status = 'replaced' and not exists (
      select 1 from public.warranty_tickets t
      join public.replacements r on r.ticket_id = t.id
      where t.order_id = new.id and t.status = 'replaced'
    ) then
      raise exception 'Order % has no replacement recorded, so it cannot be replaced',
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

    if old.status in ('delivered', 'replaced') and new.status = 'refunded' and not exists (
      select 1 from public.warranty_tickets t where t.order_id = new.id and t.status = 'refunded'
    ) then
      raise exception 'Order % has no ticket closed with a refund, so it cannot be refunded',
        old.number
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;


-- ───────────────────────────── Seller's decisions ─────────────────────────────
--
-- Each checks the caller is an admin and locks the order, so two devices queue
-- up. Security definer: tickets, claims, replacements and the vault have no
-- API write grants, so these are the only ways to change them. The order
-- trigger still checks every move and records the actor from the caller's
-- token.

-- Locks the ticket's order and returns what every decision needs, or refuses.
create function private.lock_open_ticket(p_ticket_id uuid)
returns table (order_id uuid, customer_id text, ticket_status public.ticket_status, order_status public.order_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can decide a ticket' using errcode = 'insufficient_privilege';
  end if;

  select t.order_id into target from public.warranty_tickets t where t.id = p_ticket_id;
  if not found then
    raise exception 'Ticket % was not found', p_ticket_id using errcode = 'no_data_found';
  end if;
  perform 1 from public.orders o where o.id = target.order_id for update;

  -- Read again under the lock: another device may have closed it meanwhile.
  return query
    select t.order_id, t.customer_id::text, t.status, o.status
    from public.warranty_tickets t
    join public.orders o on o.id = t.order_id
    where t.id = p_ticket_id;
end;
$$;

revoke execute on function private.lock_open_ticket(uuid) from public, anon, authenticated;

-- The seller raised it with numastore.
create function public.claim_ticket(p_ticket_id uuid, p_supplier_reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
begin
  select * into target from private.lock_open_ticket(p_ticket_id);
  if target.ticket_status <> 'open' then
    raise exception 'Ticket % is %, so it cannot be claimed', p_ticket_id, target.ticket_status
      using errcode = 'KJ006';
  end if;

  insert into public.ticket_claims (ticket_id, order_id, supplier_reference, claimed_by)
  values (p_ticket_id, target.order_id, trim(p_supplier_reference), private.requesting_user_id());

  update public.warranty_tickets set status = 'claimed' where id = p_ticket_id;
end;
$$;

-- The new credential goes into the same vault entry; the old one is kept,
-- sealed as it was. delivered_at stays: warranty and expiry run from the
-- first delivery. The order moves to replaced, or stays there.
create function private.replace_credential(
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

  insert into public.replaced_credentials (order_id, replacement_id, kind, credential)
  select v.order_id, new_replacement, v.kind, v.credential
  from public.vault_entries v
  where v.order_id = p_order_id;

  update public.vault_entries set kind = p_kind, credential = p_credential where order_id = p_order_id;

  update public.warranty_tickets set status = 'replaced', closed_at = now() where id = p_ticket_id;

  if p_order_status <> 'replaced' then
    update public.orders set status = 'replaced' where id = p_order_id;
  end if;
end;
$$;

revoke execute on function private.replace_credential(
  uuid, uuid, public.order_status, public.replacement_source, integer, text, public.credential_kind, text
) from public, anon, authenticated;

-- numastore replaced it under the claim, at no cost to the seller.
create function public.replace_from_claim(
  p_ticket_id uuid,
  p_kind public.credential_kind,
  p_credential text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
begin
  select * into target from private.lock_open_ticket(p_ticket_id);
  if target.ticket_status <> 'claimed' or target.order_status not in ('delivered', 'replaced') then
    raise exception 'Ticket % is %, so there is no claim to replace from', p_ticket_id, target.ticket_status
      using errcode = 'KJ006';
  end if;

  perform private.replace_credential(
    p_ticket_id, target.order_id, target.order_status, 'claim', 0, null, p_kind, p_credential
  );
end;
$$;

-- numastore refused, so the seller bought a fresh one: its number and cost
-- are recorded against this order.
create function public.replace_by_purchase(
  p_ticket_id uuid,
  p_supplier_order_number text,
  p_cost integer,
  p_kind public.credential_kind,
  p_credential text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
begin
  select * into target from private.lock_open_ticket(p_ticket_id);
  if target.ticket_status not in ('open', 'claimed') or target.order_status not in ('delivered', 'replaced') then
    raise exception 'Ticket % is %, so it cannot be replaced', p_ticket_id, target.ticket_status
      using errcode = 'KJ006';
  end if;

  perform private.replace_credential(
    p_ticket_id, target.order_id, target.order_status, 'purchase', p_cost,
    upper(regexp_replace(p_supplier_order_number, '[[:space:]]', '', 'g')), p_kind, p_credential
  );
end;
$$;

-- The money goes back to the number on the customer's latest proof, as for
-- every refund. The refunds trigger holds it to the order's price.
create function public.refund_ticket(
  p_ticket_id uuid,
  p_amount integer,
  p_method public.payment_method,
  p_reference text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  paid_from text;
begin
  select * into target from private.lock_open_ticket(p_ticket_id);
  if target.ticket_status not in ('open', 'claimed') or target.order_status not in ('delivered', 'replaced') then
    raise exception 'Ticket % is %, so it cannot be refunded', p_ticket_id, target.ticket_status
      using errcode = 'KJ006';
  end if;

  select p.sender_number into paid_from
    from public.payments p
    where p.order_id = target.order_id
    order by p.created_at desc
    limit 1;
  if paid_from is null then
    raise exception 'Order % has no payment to refund to', target.order_id using errcode = 'KJ007';
  end if;

  insert into public.refunds (order_id, customer_id, amount, method, reference, sent_to)
  values (target.order_id, target.customer_id, p_amount, p_method, trim(p_reference), paid_from);

  update public.warranty_tickets set status = 'refunded', closed_at = now() where id = p_ticket_id;

  update public.orders set status = 'refunded' where id = target.order_id;
end;
$$;

-- The seller looking at a credential a replacement took out. Recorded first,
-- as every vault reveal is.
create function public.reveal_replaced_credential(p_replaced_credential_id bigint)
returns table (order_id uuid, kind public.credential_kind, credential text)
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

  select r.order_id, r.kind, r.credential, v.customer_id into entry
    from public.replaced_credentials r
    join public.vault_entries v on v.order_id = r.order_id
    where r.id = p_replaced_credential_id;
  if not found then
    raise exception 'Replaced credential % was not found', p_replaced_credential_id
      using errcode = 'no_data_found';
  end if;

  insert into public.vault_reveals (order_id, customer_id, revealed_by, replaced_credential_id)
  values (entry.order_id, entry.customer_id, me, p_replaced_credential_id);

  return query select entry.order_id, entry.kind, entry.credential;
end;
$$;

revoke execute on function public.claim_ticket(uuid, text) from public, anon;
grant execute on function public.claim_ticket(uuid, text) to authenticated;

revoke execute on function public.replace_from_claim(uuid, public.credential_kind, text) from public, anon;
grant execute on function public.replace_from_claim(uuid, public.credential_kind, text) to authenticated;

revoke execute on function public.replace_by_purchase(uuid, text, integer, public.credential_kind, text)
  from public, anon;
grant execute on function public.replace_by_purchase(uuid, text, integer, public.credential_kind, text)
  to authenticated;

revoke execute on function public.refund_ticket(uuid, integer, public.payment_method, text) from public, anon;
grant execute on function public.refund_ticket(uuid, integer, public.payment_method, text) to authenticated;

revoke execute on function public.reveal_replaced_credential(bigint) from public, anon;
grant execute on function public.reveal_replaced_credential(bigint) to authenticated;


-- ───────────────────────────── Screenshots ─────────────────────────────

-- As receipts: private, the customer's own folder, read by them and admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-screenshots', 'ticket-screenshots', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy "customer reads own ticket screenshots or admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ticket-screenshots'
    and ((storage.foldername(name))[1] = (select private.requesting_user_id())
         or (select private.is_admin()))
  );
create policy "customer uploads own ticket screenshots" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ticket-screenshots'
    and (storage.foldername(name))[1] = (select private.requesting_user_id())
  );
-- Taken back only if no ticket names it: a refused ticket leaves no file.
create policy "customer removes own unused ticket screenshots" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ticket-screenshots'
    and (storage.foldername(name))[1] = (select private.requesting_user_id())
    and not exists (select 1 from public.warranty_tickets t where t.screenshot_path = objects.name)
  );


-- ───────────────────────────── Live updates ─────────────────────────────

-- New messages and ticket moves reach both sides as they happen. Claims,
-- replacements and replaced credentials stay off the socket.
alter publication supabase_realtime add table public.warranty_tickets, public.ticket_messages;
