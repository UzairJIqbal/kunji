-- Phase 10: writing a review through one call. The insert trigger fills in the
-- product and plan from the order, which a plain insert from the API can't
-- leave out because the columns are required. Invoker rights: the insert runs
-- as the caller, so the reviews policy, the column grants and the trigger's
-- checks (own order, delivered, one per order) all still apply.
create function public.leave_review(p_order_id uuid, p_rating smallint, p_comment text, p_reviewer_name text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  review_id uuid;
begin
  insert into public.reviews (order_id, customer_id, reviewer_name, rating, comment)
  values (p_order_id, private.requesting_user_id(), p_reviewer_name, p_rating, p_comment)
  returning id into review_id;
  return review_id;
end;
$$;

revoke execute on function public.leave_review(uuid, smallint, text, text) from public, anon;
grant execute on function public.leave_review(uuid, smallint, text, text) to authenticated;
