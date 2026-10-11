-- Phase 10: a customer whose account has no first name leaves the name out,
-- and the review shows as "Customer". A default rather than a null argument,
-- so the API's types say the name is optional.
create or replace function public.leave_review(p_order_id uuid, p_rating smallint, p_comment text, p_reviewer_name text default null)
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
