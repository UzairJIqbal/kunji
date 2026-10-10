-- save_plan took a null plan ID to mean "new plan", which the generated types
-- can't express. Two functions, one per job, with no nullable arguments.

drop function public.save_plan(uuid, uuid, integer, integer, integer, integer, text);

-- A plan and its supplier details are written together or not at all. Invoker
-- rights: the plans and supplier-details policies decide whether the caller
-- may write, exactly as for a direct insert. The sell price is still set by
-- the triggers from Phase 2; nothing here can type it.
create function public.create_plan(
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
  insert into public.plans (product_id, duration_days, warranty_days)
  values (p_product_id, p_duration_days, p_warranty_days)
  returning id into saved_id;

  insert into public.plan_supplier_details (plan_id, supplier_price, margin, numastore_url)
  values (saved_id, p_supplier_price, p_margin, p_numastore_url);

  return saved_id;
end;
$$;

-- A new supplier price means the seller has just looked at numastore, so it
-- counts as a price check. Changing only the margin or the link doesn't.
create function public.update_plan(
  p_plan_id uuid,
  p_product_id uuid,
  p_duration_days integer,
  p_warranty_days integer,
  p_supplier_price integer,
  p_margin integer,
  p_numastore_url text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- A plan never moves to another product; its orders name the product.
  update public.plans p
  set duration_days = p_duration_days,
      warranty_days = p_warranty_days
  where p.id = p_plan_id and p.product_id = p_product_id;

  -- Not there, or the policy hid it from this caller.
  if not found then
    raise exception 'Plan % was not found', p_plan_id
      using errcode = 'no_data_found';
  end if;

  -- An upsert, so a plan that somehow has no supplier details gets them.
  insert into public.plan_supplier_details as d
    (plan_id, supplier_price, margin, numastore_url)
  values (p_plan_id, p_supplier_price, p_margin, p_numastore_url)
  on conflict (plan_id) do update
  set price_checked_at = case
        when d.supplier_price is distinct from excluded.supplier_price then now()
        else d.price_checked_at
      end,
      supplier_price = excluded.supplier_price,
      margin = excluded.margin,
      numastore_url = excluded.numastore_url;
end;
$$;

revoke execute on function public.create_plan(uuid, integer, integer, integer, integer, text)
  from public, anon;
grant execute on function public.create_plan(uuid, integer, integer, integer, integer, text)
  to authenticated;

revoke execute on function public.update_plan(uuid, uuid, integer, integer, integer, integer, text)
  from public, anon;
grant execute on function public.update_plan(uuid, uuid, integer, integer, integer, integer, text)
  to authenticated;
