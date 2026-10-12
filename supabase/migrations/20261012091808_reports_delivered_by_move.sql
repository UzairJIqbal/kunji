-- When an order was delivered is its recorded move to delivered, the same
-- record the waiting times read. The vault entry's delivered_at is the same
-- moment for every order delivered since Phase 8, but orders delivered before
-- the vault existed have the move and no entry, and they were sales all the
-- same.
create or replace function public.report_products(p_from timestamptz default null, p_to timestamptz default null)
returns table (
  product_id uuid,
  product_name text,
  delivered bigint,
  revenue bigint,
  supplier_cost bigint,
  planned_margin bigint,
  warranty_refunds bigint,
  warranty_refund_amount bigint,
  claim_replacements bigint,
  paid_replacements bigint,
  paid_replacement_cost bigint,
  out_of_stock_refunds bigint,
  out_of_stock_refund_amount bigint,
  rejected_refunds bigint,
  rejected_refund_amount bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only an admin can read the reports' using errcode = 'insufficient_privilege';
  end if;

  return query
    with deliveries as (
      select e.order_id, min(e.created_at) as delivered_at
      from public.order_events e
      where e.to_status = 'delivered'
      group by e.order_id
    ),
    sales as (
      -- What the seller actually paid numastore for the order, never the
      -- plan's supplier price.
      select pl.product_id,
             count(*) as delivered,
             sum(o.price) as revenue,
             sum(sp.amount_paid) as supplier_cost,
             sum(m.margin) as planned_margin
      from public.orders o
      join deliveries d on d.order_id = o.id
      join public.plans pl on pl.id = o.plan_id
      join (
        select s.order_id, sum(s.amount_paid) as amount_paid
        from public.supplier_purchases s
        group by s.order_id
      ) sp on sp.order_id = o.id
      join public.order_planned_margins m on m.order_id = o.id
      where private.in_period(d.delivered_at, p_from, p_to)
      group by pl.product_id
    ),
    refund_rows as (
      select pl.product_id,
             case
               when exists (select 1 from deliveries d where d.order_id = r.order_id) then 'warranty'
               when exists (select 1 from public.supply_failures f where f.order_id = r.order_id) then 'out_of_stock'
               else 'rejected'
             end as kind,
             r.amount
      from public.refunds r
      join public.orders o on o.id = r.order_id
      join public.plans pl on pl.id = o.plan_id
      where private.in_period(r.created_at, p_from, p_to)
    ),
    refund_totals as (
      select rr.product_id,
             count(*) filter (where rr.kind = 'warranty') as warranty_refunds,
             sum(rr.amount) filter (where rr.kind = 'warranty') as warranty_refund_amount,
             count(*) filter (where rr.kind = 'out_of_stock') as out_of_stock_refunds,
             sum(rr.amount) filter (where rr.kind = 'out_of_stock') as out_of_stock_refund_amount,
             count(*) filter (where rr.kind = 'rejected') as rejected_refunds,
             sum(rr.amount) filter (where rr.kind = 'rejected') as rejected_refund_amount
      from refund_rows rr
      group by rr.product_id
    ),
    replacement_totals as (
      select pl.product_id,
             count(*) filter (where r.source = 'claim') as claim_replacements,
             count(*) filter (where r.source = 'purchase') as paid_replacements,
             sum(r.cost) filter (where r.source = 'purchase') as paid_replacement_cost
      from public.replacements r
      join public.orders o on o.id = r.order_id
      join public.plans pl on pl.id = o.plan_id
      where private.in_period(r.created_at, p_from, p_to)
      group by pl.product_id
    )
    select p.id,
           p.name,
           coalesce(s.delivered, 0),
           coalesce(s.revenue, 0)::bigint,
           coalesce(s.supplier_cost, 0)::bigint,
           coalesce(s.planned_margin, 0)::bigint,
           coalesce(rt.warranty_refunds, 0),
           coalesce(rt.warranty_refund_amount, 0)::bigint,
           coalesce(rp.claim_replacements, 0),
           coalesce(rp.paid_replacements, 0),
           coalesce(rp.paid_replacement_cost, 0)::bigint,
           coalesce(rt.out_of_stock_refunds, 0),
           coalesce(rt.out_of_stock_refund_amount, 0)::bigint,
           coalesce(rt.rejected_refunds, 0),
           coalesce(rt.rejected_refund_amount, 0)::bigint
    from public.products p
    left join sales s on s.product_id = p.id
    left join refund_totals rt on rt.product_id = p.id
    left join replacement_totals rp on rp.product_id = p.id
    where s.product_id is not null or rt.product_id is not null or rp.product_id is not null
    order by p.name;
end;
$$;
