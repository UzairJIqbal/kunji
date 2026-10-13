-- Production shares this database with development, so every order placed
-- so far is a test, and every vault entry and stock item was encrypted with the
-- development VAULT_KEY, which production can't open. Clear them before the
-- first real customer. On a fresh database this deletes nothing.
--
-- Kept: the catalogue, payment accounts, admins, customer profiles (the same
-- Clerk users sign in on production), the seller's alert settings and push
-- devices, and order_status_moves, which is the table of allowed moves rather
-- than a record of any order.
--
-- Not touched: receipt images in Storage. Supabase refuses to delete storage
-- objects from SQL, because the file itself would be left behind. With their
-- orders gone, nothing points at them any more.
--
-- Children before parents, following the foreign keys.

delete from public.vault_reveals;
delete from public.replaced_credentials;
delete from public.replacements;
delete from public.ticket_claims;
delete from public.ticket_messages;
delete from public.refunds;
delete from public.warranty_tickets;
delete from public.reviews;
delete from public.vault_entries;
delete from public.stock_items;
delete from public.supplier_purchases;
delete from public.supply_failures;
delete from public.payment_rejections;
delete from public.payments;
delete from public.order_events;
delete from public.order_planned_margins;
delete from public.orders;
