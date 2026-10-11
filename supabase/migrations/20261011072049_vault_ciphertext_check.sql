-- The vault's ciphertext check counted padding wrong: the shortest real
-- ciphertext (IV, tag and one byte, 29 bytes) is 40 base64 characters
-- including its "=", and the check wanted 40 before it. Now it's held to
-- well-formed base64 of at least that length, and still refuses plain text.
alter table public.vault_entries drop constraint vault_entries_credential_check;
alter table public.vault_entries add constraint vault_entries_credential_check check (
  credential ~ '^v1:([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
  and length(credential) between 43 and 20000
);
