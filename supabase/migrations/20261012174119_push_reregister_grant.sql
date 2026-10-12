-- Re-registering a browser is an upsert on endpoint_tag, and PostgREST's
-- upsert sets every column it was given, the conflict column included. The
-- tag is the same value it already had, so this widens nothing in practice.
grant update (endpoint_tag) on public.push_subscriptions to authenticated;
