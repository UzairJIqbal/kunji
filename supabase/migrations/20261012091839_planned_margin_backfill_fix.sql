-- Two test orders were placed before their plan's margin was raised above
-- what they cost, so copying today's margin gave them a planned margin larger
-- than their price, which can't be. For those, the order's own price less the
-- plan's supplier price is what the margin must have been: the supplier price
-- is the half that hasn't moved.
update public.order_planned_margins m
set margin = o.price - d.supplier_price
from public.orders o
join public.plan_supplier_details d on d.plan_id = o.plan_id
where o.id = m.order_id
  and m.margin >= o.price
  and o.price > d.supplier_price;

-- A margin is part of the price, so never all of it.
do $$
begin
  if exists (
    select 1 from public.order_planned_margins m
    join public.orders o on o.id = m.order_id
    where m.margin >= o.price
  ) then
    raise exception 'An order still has a planned margin as large as its price';
  end if;
end;
$$;
