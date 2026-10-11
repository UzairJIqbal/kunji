-- A refunded order keeps its vault entry as a record, but the customer got
-- their money back, so the login is no longer theirs to see. The refusal is
-- here rather than in the page so it holds however the reveal is asked for.
-- The seller can still reveal it, for following up with numastore.
create or replace function public.reveal_credential(p_order_id uuid)
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

  select v.kind, v.credential, v.customer_id, o.status into entry
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

  return query select entry.kind, entry.credential;
end;
$$;

revoke execute on function public.reveal_credential(uuid) from public, anon;
grant execute on function public.reveal_credential(uuid) to authenticated;
