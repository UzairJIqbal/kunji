-- A stock item's ciphertext is sealed to the item's id, so the app has to
-- know the id before it encrypts: it makes one per line and sends it with the
-- line. Each item is now {id, line, credential, fingerprint,
-- supplier_order_number, cost, expires_on}; nothing else changes. An id
-- already taken is the primary key's own unique violation, reported as the
-- line's number being used, and can only come from a resent request.

create or replace function public.add_stock(p_plan_id uuid, p_items jsonb)
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
      insert into public.stock_items (id, plan_id, credential, fingerprint, supplier_order_number, cost, expires_at, added_by)
      values (
        (item ->> 'id')::uuid,
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
