-- The seller takes an unsold item out of stock: a typo to paste again, or a
-- held-back login they've decided not to sell. A delivered item is a
-- customer's login and part of an order's record, so it stays.
--
-- The row is locked first. If an approval is taking it at the same moment,
-- this waits for that to finish and then refuses, rather than deleting a login
-- out from under a vault entry.
create function public.remove_stock_item(p_item_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  delivered_to uuid;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can remove stock' using errcode = 'insufficient_privilege';
  end if;

  select i.order_id into delivered_to from public.stock_items i where i.id = p_item_id for update;
  if not found then
    raise exception 'Stock item % was not found', p_item_id using errcode = 'no_data_found';
  end if;
  if delivered_to is not null then
    raise exception 'Stock item % was already delivered', p_item_id using errcode = 'KJ013';
  end if;

  delete from public.stock_items where id = p_item_id;
end;
$$;

revoke execute on function public.remove_stock_item(uuid) from public, anon;
grant execute on function public.remove_stock_item(uuid) to authenticated;
