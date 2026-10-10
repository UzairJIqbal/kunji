-- Phase 3: what the seller needs to list a product honestly, the bucket its
-- image lives in, and the multi-row writes behind the plan form.


-- ───────────────────────────── Honest facts ─────────────────────────────

create type public.account_type as enum (
  'own_account',   -- the customer gets an account of their own
  'shared_slot',   -- a seat on an account other people also use
  'email_invite'   -- an invite sent to the customer's own email
);

-- Category is the seller's own word, not a fixed list: the storefront groups by
-- whatever the seller has typed, and the form suggests the ones already in use.
-- A sold-out product stays listed (the storefront says so); hiding it is
-- `active = false`, which takes it off the storefront without deleting it.
alter table public.products
  add column category text,
  add column account_type public.account_type,
  add column plan_note text
    check (plan_note is null or length(trim(plan_note)) > 0),
  add column needs_activation_email boolean not null default false,
  add column setup_instructions text not null default '',
  add column image_path text
    check (image_path ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$'),
  add column sold_out boolean not null default false;

-- The only products that can exist before this migration are Phase 2's
-- labelled test seed. They get test values so the columns can be required; on
-- a database built from scratch the table is empty here and this does nothing.
update public.products
set category = 'Test', account_type = 'own_account'
where category is null;

alter table public.products
  alter column category set not null,
  alter column account_type set not null,
  add constraint products_category_check check (length(trim(category)) > 0);


-- ───────────────────────────── Product images ─────────────────────────────

-- Public, because the storefront shows these to anyone. Small, because the
-- storefront is opened on mobile data. Only image types a phone can show.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 1048576,
  array['image/jpeg', 'image/png', 'image/webp']
);

-- A public bucket serves its files by URL without a policy. These cover the
-- API: only an admin uploads, lists or deletes. Select is needed for upload
-- too, because Storage reads back the row it just inserted. No update policy:
-- a new image is a new file, never an overwrite.
create policy "admin reads product image objects" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()));
create policy "admin uploads product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (select private.is_admin()));
create policy "admin deletes product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()));


-- ───────────────────────────── Plan writes ─────────────────────────────

-- A plan and its supplier details are saved together or not at all. Invoker
-- rights: the plans and supplier-details policies decide whether the caller
-- may write, exactly as for a direct insert. The sell price is still set by
-- the triggers from Phase 2; nothing here can type it.
--
-- A new supplier price means the seller has just looked at numastore, so it
-- counts as a price check. Changing only the margin or the link doesn't.
create function public.save_plan(
  p_plan_id uuid,
  p_product_id uuid,
  p_duration_days integer,
  p_warranty_days integer,
  p_supplier_price integer,
  p_margin integer,
  p_numastore_url text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if p_plan_id is null then
    insert into public.plans (product_id, duration_days, warranty_days)
    values (p_product_id, p_duration_days, p_warranty_days)
    returning id into saved_id;

    insert into public.plan_supplier_details (plan_id, supplier_price, margin, numastore_url)
    values (saved_id, p_supplier_price, p_margin, p_numastore_url);

    return saved_id;
  end if;

  -- A plan never moves to another product; its orders name the product.
  update public.plans p
  set duration_days = p_duration_days,
      warranty_days = p_warranty_days
  where p.id = p_plan_id and p.product_id = p_product_id
  returning p.id into saved_id;

  -- Not there, or the policy hid it from this caller.
  if saved_id is null then
    raise exception 'Plan % was not found', p_plan_id
      using errcode = 'no_data_found';
  end if;

  insert into public.plan_supplier_details as d
    (plan_id, supplier_price, margin, numastore_url)
  values (saved_id, p_supplier_price, p_margin, p_numastore_url)
  on conflict (plan_id) do update
  set price_checked_at = case
        when d.supplier_price is distinct from excluded.supplier_price then now()
        else d.price_checked_at
      end,
      supplier_price = excluded.supplier_price,
      margin = excluded.margin,
      numastore_url = excluded.numastore_url;

  return saved_id;
end;
$$;

-- The seller looked at numastore and the price still holds. The time is the
-- database's, not whatever clock sent the request.
create function public.mark_plan_price_checked(p_plan_id uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  checked_at timestamptz;
begin
  update public.plan_supplier_details d
  set price_checked_at = now()
  where d.plan_id = p_plan_id
  returning d.price_checked_at into checked_at;

  if checked_at is null then
    raise exception 'Plan % has no supplier details to check', p_plan_id
      using errcode = 'no_data_found';
  end if;

  return checked_at;
end;
$$;

revoke execute on function public.save_plan(uuid, uuid, integer, integer, integer, integer, text)
  from public, anon;
grant execute on function public.save_plan(uuid, uuid, integer, integer, integer, integer, text)
  to authenticated;

revoke execute on function public.mark_plan_price_checked(uuid) from public, anon;
grant execute on function public.mark_plan_price_checked(uuid) to authenticated;
