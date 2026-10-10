-- Phase 2 seed: just enough rows to prove the policies.
--
-- The three Clerk IDs are real accounts in the development Clerk instance:
-- two customers who signed up with Google, and a separate admin, so the admin's
-- view of every order never gets mixed up with a customer's own list.
-- Products, prices and the payment account are labelled as test data; none of
-- them is a real listing.
--
-- Run as the database owner, so order events record no actor (actor_id null).

do $$
begin
  if exists (select 1 from public.orders) then
    raise exception 'Orders already exist; the seed only runs on an empty database';
  end if;
end;
$$;

insert into public.admins (clerk_user_id) values
  ('user_3KUdcVhxrtxdCIPY6Akd5scWFja');

insert into public.customer_profiles (clerk_user_id) values
  ('user_3KUcraei2uW5SMILsEpqG002gln'),  -- customer A
  ('user_3KUcxoDEPQEcPYZEAiERtjjEcOI');  -- customer B

insert into public.products (slug, name, description, active, category, account_type) values
  ('test-product-one', 'Test product one', 'Seed data for testing. Not for sale.', true, 'Test', 'own_account'),
  ('test-product-two', 'Test product two', 'Seed data for testing. Not for sale.', true, 'Test', 'own_account');

insert into public.plans (product_id, duration_days, warranty_days)
select id, d.duration_days, d.warranty_days
from public.products p
join (values
  ('test-product-one', 30, 30),
  ('test-product-one', 90, 30),
  ('test-product-two', 30, 7)
) as d (slug, duration_days, warranty_days) on d.slug = p.slug;

-- The insert trigger on these rows sets each plan's sell price.
insert into public.plan_supplier_details (plan_id, supplier_price, margin, numastore_url)
select pl.id, d.supplier_price, d.margin, 'https://numastore.pro/'
from public.plans pl
join public.products p on p.id = pl.product_id
join (values
  ('test-product-one', 30, 900, 300),
  ('test-product-one', 90, 2400, 600),
  ('test-product-two', 30, 500, 200)
) as d (slug, duration_days, supplier_price, margin)
  on d.slug = p.slug and d.duration_days = pl.duration_days;

insert into public.payment_accounts (method, account_title, account_number) values
  ('easypaisa', 'Test account (seed)', '03000000000');

-- Places an order and walks it through the given moves, recording the payment
-- before `verifying` and the supplier purchase before `bought`, as the order
-- trigger demands. A temp function, so nothing of it outlives this session.
create function pg_temp.seed_order(
  customer text,
  product_slug text,
  days integer,
  moves public.order_status[]
) returns void
language plpgsql
as $$
declare
  new_order uuid;
  new_number bigint;
  move public.order_status;
begin
  insert into public.orders (customer_id, plan_id)
  select customer, pl.id
  from public.plans pl
  join public.products p on p.id = pl.product_id
  where p.slug = product_slug and pl.duration_days = days
  returning id, number into new_order, new_number;

  foreach move in array moves loop
    if move = 'verifying' then
      insert into public.payments (order_id, customer_id, method, transaction_id, sender_number)
      values (new_order, customer, 'easypaisa', 'SEED-TX-' || new_number, '03000000000');
    end if;
    if move = 'bought' then
      insert into public.supplier_purchases (order_id, supplier_order_number, amount_paid)
      select new_order, 'SEED-SUP-' || new_number, d.supplier_price
      from public.orders o
      join public.plan_supplier_details d on d.plan_id = o.plan_id
      where o.id = new_order;
    end if;
    update public.orders set status = move where id = new_order;
  end loop;
end;
$$;

-- Customer A: one order at each early step, and one delivered.
select pg_temp.seed_order('user_3KUcraei2uW5SMILsEpqG002gln', 'test-product-one', 30, '{}');
select pg_temp.seed_order('user_3KUcraei2uW5SMILsEpqG002gln', 'test-product-one', 90, '{verifying}');
select pg_temp.seed_order('user_3KUcraei2uW5SMILsEpqG002gln', 'test-product-two', 30, '{verifying,paid}');
select pg_temp.seed_order('user_3KUcraei2uW5SMILsEpqG002gln', 'test-product-one', 30, '{verifying,paid,bought,delivered}');

-- Customer B: the remaining states, so every state has at least one order.
select pg_temp.seed_order('user_3KUcxoDEPQEcPYZEAiERtjjEcOI', 'test-product-two', 30, '{verifying,rejected}');
select pg_temp.seed_order('user_3KUcxoDEPQEcPYZEAiERtjjEcOI', 'test-product-one', 90, '{verifying,paid,bought}');
select pg_temp.seed_order('user_3KUcxoDEPQEcPYZEAiERtjjEcOI', 'test-product-two', 30, '{verifying,paid,refunded}');
select pg_temp.seed_order('user_3KUcxoDEPQEcPYZEAiERtjjEcOI', 'test-product-one', 30, '{verifying,paid,bought,delivered,replaced}');
select pg_temp.seed_order('user_3KUcxoDEPQEcPYZEAiERtjjEcOI', 'test-product-two', 30, '{}');
