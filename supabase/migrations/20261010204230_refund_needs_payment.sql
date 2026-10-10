-- Phase 6 review: a refund goes back to the number on the customer's latest
-- proof, so with no proof there is nowhere to send it. Every rejected order
-- came through verifying and so has one, but if that ever stops being true the
-- seller should read why, not a not-null violation.
--   KJ007  the order has no payment to refund to

create or replace function public.refund_rejected_order(
  p_order_id uuid,
  p_amount integer,
  p_method public.payment_method,
  p_reference text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target record;
  paid_from text;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can record a refund' using errcode = 'insufficient_privilege';
  end if;

  select o.status, o.customer_id into target from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'Order % was not found', p_order_id using errcode = 'no_data_found';
  end if;
  if target.status <> 'rejected' then
    raise exception 'Order % is %, not rejected', p_order_id, target.status
      using errcode = 'KJ006';
  end if;

  select p.sender_number into paid_from
    from public.payments p
    where p.order_id = p_order_id
    order by p.created_at desc
    limit 1;
  if paid_from is null then
    raise exception 'Order % has no payment to refund to', p_order_id using errcode = 'KJ007';
  end if;

  insert into public.refunds (order_id, customer_id, amount, method, reference, sent_to)
  values (p_order_id, target.customer_id, p_amount, p_method, trim(p_reference), paid_from);

  update public.orders set status = 'refunded' where id = p_order_id;
end;
$$;
