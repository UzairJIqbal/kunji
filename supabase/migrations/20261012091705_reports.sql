-- Phase 11: reports. Every number is a sum, count or median over recorded
-- rows, worked out here. Nothing is estimated.
--
-- When something counts:
--   a sale (price, numastore cost, planned margin)  when it was delivered
--   a refund                                        when it was sent
--   a replacement                                   when it was made
--   a waiting time                                  when its step ended


-- ───────────────────────────── Planned margin ─────────────────────────────

-- The margin the plan promised when the order was placed, frozen like the
-- order's price, so changing a plan today doesn't rewrite last month. Its own
-- admin-only table, as plan_supplier_details is, because customers can read
-- their own orders rows and a margin is supplier detail.
create table public.order_planned_margins (
  order_id uuid primary key references public.orders (id),
  margin integer not null check (margin >= 0)
);

-- Orders placed before this phase take their plan's margin as it is now:
-- the closest record there is, and all of them are test orders.
insert into public.order_planned_margins (order_id, margin)
select o.id, d.margin
from public.orders o
join public.plan_supplier_details d on d.plan_id = o.plan_id;

-- orders_before_insert has already refused a plan with no supplier details,
-- so there is always a margin to copy.
create function private.orders_record_planned_margin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_planned_margins (order_id, margin)
  select new.id, d.margin
  from public.plan_supplier_details d
  where d.plan_id = new.plan_id;
  return null;
end;
$$;

create trigger orders_record_planned_margin
  after insert on public.orders
  for each row execute function private.orders_record_planned_margin();

create policy "admin reads planned margins" on public.order_planned_margins
  for select to authenticated using ((select private.is_admin()));

-- Written only by the trigger; never changed.
revoke all on public.order_planned_margins from anon, authenticated;
grant select on public.order_planned_margins to authenticated;


-- ───────────────────────────── Periods ─────────────────────────────

-- A period is [p_from, p_to); a null end is open. Both null is all time.
create function private.in_period(t timestamptz, p_from timestamptz, p_to timestamptz)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from is null or t >= p_from) and (p_to is null or t < p_to)
$$;


-- ───────────────────────────── Per product ─────────────────────────────
--
-- Invoker rights, so every table's own policy still applies; the admin check
-- turns a customer's call into a refusal rather than sums over their own rows.

-- A refund is one of three kinds, by what had happened to the order:
--   warranty      it was delivered, so the money returned was revenue
--   out_of_stock  numastore couldn't supply it
--   rejected      the payment was rejected and the order never went ahead
-- Only a warranty refund lowers profit; the other two return money that never
-- counted as revenue.
create function public.report_products(p_from timestamptz default null, p_to timestamptz default null)
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
    with sales as (
      -- What the seller actually paid numastore for the order, never the
      -- plan's supplier price.
      select pl.product_id,
             count(*) as delivered,
             sum(o.price) as revenue,
             sum(sp.amount_paid) as supplier_cost,
             sum(m.margin) as planned_margin
      from public.orders o
      join public.vault_entries v on v.order_id = o.id
      join public.plans pl on pl.id = o.plan_id
      join (
        select s.order_id, sum(s.amount_paid) as amount_paid
        from public.supplier_purchases s
        group by s.order_id
      ) sp on sp.order_id = o.id
      join public.order_planned_margins m on m.order_id = o.id
      where private.in_period(v.delivered_at, p_from, p_to)
      group by pl.product_id
    ),
    refund_rows as (
      select pl.product_id,
             case
               when exists (select 1 from public.vault_entries v where v.order_id = r.order_id) then 'warranty'
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


-- ───────────────────────────── Waiting times ─────────────────────────────

-- From the order's recorded moves. Proof submitted is the move to verifying;
-- approved is the move to paid, which for an order rejected first includes
-- the time it sat rejected: the customer was waiting all the same. A step
-- counts in the period it ended. "total" is proof submitted to delivered.
create function public.report_waiting_times(p_from timestamptz default null, p_to timestamptz default null)
returns table (
  step text,
  orders bigint,
  median_seconds double precision,
  slowest_seconds double precision,
  over_30_minutes bigint
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
    with moves as (
      select e.order_id,
             min(e.created_at) filter (where e.to_status = 'verifying') as proof_at,
             min(e.created_at) filter (where e.to_status = 'paid') as paid_at,
             min(e.created_at) filter (where e.to_status = 'bought') as bought_at,
             min(e.created_at) filter (where e.to_status = 'delivered') as delivered_at
      from public.order_events e
      group by e.order_id
    ),
    steps as (
      select 'proof_to_approved' as step, m.paid_at as ended_at, m.paid_at - m.proof_at as waited
        from moves m where m.proof_at is not null and m.paid_at is not null
      union all
      select 'approved_to_bought', m.bought_at, m.bought_at - m.paid_at
        from moves m where m.paid_at is not null and m.bought_at is not null
      union all
      select 'bought_to_delivered', m.delivered_at, m.delivered_at - m.bought_at
        from moves m where m.bought_at is not null and m.delivered_at is not null
      union all
      select 'total', m.delivered_at, m.delivered_at - m.proof_at
        from moves m where m.proof_at is not null and m.delivered_at is not null
    )
    select s.step,
           count(*),
           percentile_cont(0.5) within group (order by extract(epoch from s.waited)::double precision),
           max(extract(epoch from s.waited))::double precision,
           count(*) filter (where s.waited > interval '30 minutes')
    from steps s
    where private.in_period(s.ended_at, p_from, p_to)
    group by s.step;
end;
$$;


-- ───────────────────────────── Orders for export ─────────────────────────────

-- The orders placed in the period, with what each has cost and returned so
-- far. No credential, no customer contact detail: those columns aren't here.
create function public.report_orders(p_from timestamptz default null, p_to timestamptz default null)
returns table (
  number bigint,
  placed_at timestamptz,
  product_name text,
  duration_days integer,
  price integer,
  supplier_cost bigint,
  refund integer,
  replacement_cost bigint,
  status public.order_status
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
    select o.number,
           o.created_at,
           o.product_name,
           o.duration_days,
           o.price,
           (select sum(s.amount_paid) from public.supplier_purchases s where s.order_id = o.id)::bigint,
           r.amount,
           (select sum(x.cost) from public.replacements x where x.order_id = o.id)::bigint,
           o.status
    from public.orders o
    left join public.refunds r on r.order_id = o.id
    where private.in_period(o.created_at, p_from, p_to)
    order by o.number;
end;
$$;

revoke execute on function public.report_products(timestamptz, timestamptz) from public, anon;
grant execute on function public.report_products(timestamptz, timestamptz) to authenticated;

revoke execute on function public.report_waiting_times(timestamptz, timestamptz) from public, anon;
grant execute on function public.report_waiting_times(timestamptz, timestamptz) to authenticated;

revoke execute on function public.report_orders(timestamptz, timestamptz) from public, anon;
grant execute on function public.report_orders(timestamptz, timestamptz) to authenticated;
