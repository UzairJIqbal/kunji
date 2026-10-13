-- The seller signs in as uzair.j1089@gmail.com through Google, and that
-- account is the only admin. It needs 2-step verification on, in Clerk and
-- on the Google account.
--
-- The previous admin used a Clerk "+clerk_test" address. On Clerk's
-- development instance, which the live site runs on, that kind of address
-- accepts the fixed code 424242, so anyone could have signed in as the seller
-- and opened every vault.

delete from public.admins where clerk_user_id <> 'user_3KUcraei2uW5SMILsEpqG002gln';

insert into public.admins (clerk_user_id)
values ('user_3KUcraei2uW5SMILsEpqG002gln')
on conflict (clerk_user_id) do nothing;
