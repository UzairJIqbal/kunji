-- A vault entry is made only by deliver_order, never by a bare insert. Before
-- this, an admin could insert an entry on an order that wasn't bought, and the
-- customer would see a vault entry for an order still at paid. Closing the
-- insert path leaves deliver_order's checks as the only way in.

drop policy "admin delivers to vaults" on public.vault_entries;
revoke insert on public.vault_entries from authenticated;

-- Now security definer, because no API role can insert into vault_entries.
-- Its own admin check stands in for the insert policy. The order trigger
-- still enforces the move and records the actor from the caller's token,
-- and so does the vault_entries trigger.
create or replace function public.deliver_order(
  p_order_id uuid,
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

-- Replacing keeps the grants, but restating them keeps this file the record.
revoke execute on function public.deliver_order(uuid, public.credential_kind, text) from public, anon;
grant execute on function public.deliver_order(uuid, public.credential_kind, text) to authenticated;
