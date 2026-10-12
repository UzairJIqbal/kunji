-- ntfy is gone from Kunji: the seller hears of new proof by browser push and
-- email only. Its switch goes, and the narrow door stops returning it. The
-- function's result type changes, so it is dropped and made again, with the
-- same order condition and the same grants.

drop function public.proof_alert_targets(uuid);

alter table public.seller_alert_settings drop column ntfy_on;

create function public.proof_alert_targets(p_order_id uuid)
returns table (push_on boolean, email_on boolean, subscriptions text[])
language sql
stable
security definer
set search_path = ''
as $$
  select s.push_on, s.email_on,
         coalesce((select array_agg(p.subscription order by p.created_at)
                     from public.push_subscriptions p), '{}')
    from public.seller_alert_settings s
   where exists (
     select 1 from public.orders o
      where o.id = p_order_id
        and o.customer_id = private.requesting_user_id()
        and o.status = 'verifying'
   )
$$;

revoke execute on function public.proof_alert_targets(uuid) from public, anon;
grant execute on function public.proof_alert_targets(uuid) to authenticated;
