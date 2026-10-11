-- Phase 10: reviews. A customer says how a delivered order went; the seller
-- can hide a review, never change it.
--
-- Errors, as before:
--   KJ006  the review is already hidden
--   KJ011  the order was never delivered, so it can't be reviewed
-- A second review on one order is the unique constraint's own 23505.


-- ───────────────────────────── Reviews ─────────────────────────────

-- One per order. product_id and duration_days are copied from the order, so a
-- review says which plan it was about whatever happens to the catalogue later.
-- reviewer_name is the first name the customer's Clerk account had when they
-- wrote it, null if it had none. Hidden is the seller's decision, with why.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique,
  customer_id public.clerk_user_id not null,
  product_id uuid not null references public.products (id),
  duration_days integer not null,
  reviewer_name text check (length(reviewer_name) between 1 and 40 and reviewer_name = trim(reviewer_name)),
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (length(comment) <= 500 and comment = trim(comment)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  hidden_at timestamptz,
  hidden_reason text check (length(hidden_reason) between 1 and 300),
  hidden_by public.clerk_user_id,
  foreign key (order_id, customer_id) references public.orders (id, customer_id),
  check ((hidden_at is null) = (hidden_reason is null))
);
create index reviews_product_id_idx on public.reviews (product_id, created_at desc);
create index reviews_customer_id_idx on public.reviews (customer_id);

-- A review exists only because its own customer wrote it about an order that
-- was delivered. Refunded counts if it was delivered first: the vault entry is
-- the proof of delivery, and a refund is part of how it went. Nobody else can
-- write one, not the seller and not SQL run straight on the database, where
-- there is no signed-in user: no seeded or imported reviews.
create function private.reviews_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
begin
  if private.requesting_user_id() is distinct from new.customer_id then
    raise exception 'A review is written by the order''s own customer'
      using errcode = 'insufficient_privilege';
  end if;

  select o.number, o.status, o.duration_days, pl.product_id,
         exists (select 1 from public.vault_entries v where v.order_id = o.id) as delivered
    into target
    from public.orders o
    join public.plans pl on pl.id = o.plan_id
    where o.id = new.order_id and o.customer_id = new.customer_id;
  if not found or target.status not in ('delivered', 'replaced', 'refunded') or not target.delivered then
    raise exception 'Order % was never delivered, so it cannot be reviewed', target.number
      using errcode = 'KJ011';
  end if;

  new.product_id := target.product_id;
  new.duration_days := target.duration_days;
  new.created_at := now();
  new.updated_at := now();
  new.hidden_at := null;
  new.hidden_reason := null;
  new.hidden_by := null;
  return new;
end;
$$;

create trigger reviews_before_insert
  before insert on public.reviews
  for each row execute function private.reviews_before_insert();

-- The stars and words are the customer's alone to change; hiding is the
-- seller's alone. Held here so it's true however the update arrives.
create function private.reviews_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.id, new.order_id, new.customer_id, new.product_id, new.duration_days,
      new.reviewer_name, new.created_at)
     is distinct from
     (old.id, old.order_id, old.customer_id, old.product_id, old.duration_days,
      old.reviewer_name, old.created_at) then
    raise exception 'A review keeps the order and name it was written with'
      using errcode = 'check_violation';
  end if;

  if (new.rating, new.comment) is distinct from (old.rating, old.comment) then
    if private.requesting_user_id() is distinct from old.customer_id then
      raise exception 'Only the customer who wrote a review can change it'
        using errcode = 'insufficient_privilege';
    end if;
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;

  if (new.hidden_at, new.hidden_reason, new.hidden_by)
     is distinct from (old.hidden_at, old.hidden_reason, old.hidden_by)
     and not private.is_admin() then
    raise exception 'Only the seller can hide a review' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger reviews_before_update
  before update on public.reviews
  for each row execute function private.reviews_before_update();

-- The store reads as anon: visible reviews only, and nothing about who wrote
-- them beyond the first name. A signed-in customer reads their own, hidden or
-- not; the seller reads every one.
create policy "public reads visible reviews" on public.reviews
  for select to anon
  using (hidden_at is null);
create policy "read own reviews or admin" on public.reviews
  for select to authenticated
  using (customer_id = (select private.requesting_user_id()) or (select private.is_admin()));
create policy "customer reviews own orders" on public.reviews
  for insert to authenticated
  with check (customer_id = (select private.requesting_user_id()));
create policy "customer edits own review" on public.reviews
  for update to authenticated
  using (customer_id = (select private.requesting_user_id()))
  with check (customer_id = (select private.requesting_user_id()));

-- No delete for anyone, and no update grant on anything but the stars and
-- words: hiding goes through hide_review below.
revoke all on public.reviews from anon, authenticated;
grant select (id, product_id, duration_days, reviewer_name, rating, comment, created_at, updated_at, hidden_at)
  on public.reviews to anon;
grant select on public.reviews to authenticated;
grant insert (order_id, customer_id, reviewer_name, rating, comment) on public.reviews to authenticated;
grant update (rating, comment) on public.reviews to authenticated;


-- ───────────────────────────── Ratings ─────────────────────────────

-- Count and total of the visible reviews per product, worked out when it's
-- read. The average is divided in the app, to one decimal and never rounded
-- up. Invoker rights, so the reviews policy still decides which rows count.
create view public.product_ratings
with (security_invoker = true)
as
  select r.product_id, count(*)::integer as review_count, sum(r.rating)::integer as rating_total
  from public.reviews r
  where r.hidden_at is null
  group by r.product_id;

revoke all on public.product_ratings from anon, authenticated;
grant select on public.product_ratings to anon, authenticated;


-- ───────────────────────────── Hiding ─────────────────────────────

-- The seller takes a review off the store and says why. Only the hidden
-- columns change; the update trigger refuses anything else.
create function public.hide_review(p_review_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can hide a review' using errcode = 'insufficient_privilege';
  end if;

  select r.hidden_at into target from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review % was not found', p_review_id using errcode = 'no_data_found';
  end if;
  if target.hidden_at is not null then
    raise exception 'Review % is already hidden', p_review_id using errcode = 'KJ006';
  end if;

  update public.reviews
  set hidden_at = now(), hidden_reason = trim(p_reason), hidden_by = private.requesting_user_id()
  where id = p_review_id;
end;
$$;

revoke execute on function public.hide_review(uuid, text) from public, anon;
grant execute on function public.hide_review(uuid, text) to authenticated;
