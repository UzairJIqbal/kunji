-- Table privileges for the API roles.
--
-- This project doesn't hand anon and authenticated SELECT/INSERT/UPDATE/DELETE
-- on new tables, so without these grants every API read fails with
-- "permission denied" before a policy is even consulted. It does hand them
-- TRUNCATE, REFERENCES and TRIGGER, which no API caller needs and TRUNCATE
-- ignores row-level security, so those go.
--
-- Grants say which kinds of statement a role may attempt on a table; the
-- policies still decide which rows. Each grant below matches a policy in the
-- previous migration and nothing more: no DELETE where no delete policy exists.

revoke all on
  public.admins,
  public.customer_profiles,
  public.products,
  public.plans,
  public.plan_supplier_details,
  public.payment_accounts,
  public.order_status_moves,
  public.orders,
  public.payments,
  public.supplier_purchases,
  public.order_events
from anon, authenticated;

-- Readable signed out: the storefront's catalogue and checkout accounts.
grant select on public.products, public.plans, public.payment_accounts to anon;

grant select on
  public.admins,
  public.order_status_moves,
  public.order_events
to authenticated;

grant select, insert, update on
  public.customer_profiles,
  public.orders,
  public.payments,
  public.supplier_purchases
to authenticated;

grant select, insert, update, delete on
  public.products,
  public.plans,
  public.plan_supplier_details,
  public.payment_accounts
to authenticated;
