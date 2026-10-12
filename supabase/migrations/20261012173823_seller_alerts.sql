-- Phase 12: new order notifications. When proof lands, the seller hears it by
-- browser push and email as well as ntfy. Nothing here moves an order: these
-- rows only say where to tell the seller and whether to.


-- ───────────────────────────── Switches ─────────────────────────────

-- One row, one switch per channel, all on to begin with. They govern only the
-- new-payment notification; other ntfy pings (tickets, buy-needed) don't ask.
create table public.seller_alert_settings (
  id boolean primary key default true check (id),
  push_on boolean not null default true,
  email_on boolean not null default true,
  ntfy_on boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.seller_alert_settings (id) values (true);

alter table public.seller_alert_settings enable row level security;

create policy "admin reads alert settings" on public.seller_alert_settings
  for select to authenticated using ((select private.is_admin()));
create policy "admin updates alert settings" on public.seller_alert_settings
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create function private.seller_alert_settings_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger seller_alert_settings_touch
  before update on public.seller_alert_settings
  for each row execute function private.seller_alert_settings_touch();

revoke all on public.seller_alert_settings from anon, authenticated;
grant select on public.seller_alert_settings to authenticated;
grant update (push_on, email_on, ntfy_on) on public.seller_alert_settings to authenticated;


-- ───────────────────────────── Push devices ─────────────────────────────

-- A browser the seller switched notifications on in. The subscription (its
-- push endpoint and keys) is sealed by the server before it gets here, so the
-- database only ever holds ciphertext. endpoint_tag is a keyed hash of the
-- endpoint, also made by the server: it lets the same browser registering
-- again replace its row, and it's what proves the server opened a
-- subscription when it asks to drop an expired one.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscription text not null check (subscription ~ '^v1:[A-Za-z0-9+/]+={0,2}$'),
  endpoint_tag text not null unique check (endpoint_tag ~ '^[0-9a-f]{64}$'),
  label text not null check (length(label) between 1 and 60),
  created_by public.clerk_user_id not null default private.requesting_user_id(),
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "admin reads push subscriptions" on public.push_subscriptions
  for select to authenticated using ((select private.is_admin()));
create policy "admin adds push subscriptions" on public.push_subscriptions
  for insert to authenticated with check ((select private.is_admin()));
create policy "admin updates push subscriptions" on public.push_subscriptions
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin removes push subscriptions" on public.push_subscriptions
  for delete to authenticated using ((select private.is_admin()));

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant insert (subscription, endpoint_tag, label) on public.push_subscriptions to authenticated;
-- Re-registering the same browser refreshes its keys and name.
grant update (subscription, label) on public.push_subscriptions to authenticated;


-- ───────────────────────────── Telling the seller ─────────────────────────────

-- Proof is submitted as the customer, who can read none of the rows above, and
-- the app never holds the service key. So the notification is sent through
-- this one narrow door: the order's own customer, while that order is
-- verifying, gets the switches and the sealed subscriptions. Sealed means the
-- customer could call this themselves and learn nothing; only the server can
-- open them. Not the endpoint tags: those would let a customer remove the
-- seller's devices.
create function public.proof_alert_targets(p_order_id uuid)
returns table (push_on boolean, email_on boolean, ntfy_on boolean, subscriptions text[])
language sql
stable
security definer
set search_path = ''
as $$
  select s.push_on, s.email_on, s.ntfy_on,
         coalesce((select array_agg(p.subscription order by p.created_at)
                     from public.push_subscriptions p), '{}')
    from public.seller_alert_settings s
   where exists (
     select 1 from public.orders o
      where o.id = p_order_id
        and o.customer_id = private.requesting_user_id()
        and o.status = 'verifying'
   )
$$;

-- An expired subscription is dropped the first time sending to it fails. Only
-- the server, having opened the subscription, can name its tag, so a customer
-- calling this can remove nothing. Same order condition as above.
create function public.drop_push_subscription(p_order_id uuid, p_endpoint_tag text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions p
   where p.endpoint_tag = p_endpoint_tag
     and exists (
       select 1 from public.orders o
        where o.id = p_order_id
          and o.customer_id = private.requesting_user_id()
          and o.status = 'verifying'
     )
$$;

revoke execute on function public.proof_alert_targets(uuid) from public, anon;
grant execute on function public.proof_alert_targets(uuid) to authenticated;
revoke execute on function public.drop_push_subscription(uuid, text) from public, anon;
grant execute on function public.drop_push_subscription(uuid, text) to authenticated;
