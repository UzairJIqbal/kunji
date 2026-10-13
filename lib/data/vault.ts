import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

// The vault as its owner sees it. As with orders, no `where customer_id = …`:
// the vault_entries policy decides whose entries come back. The credential
// column isn't granted to any API role, so it can't be selected here by
// mistake; the only way to it is the recorded reveal.

const VAULT_LIST_LIMIT = 50;
const orderNumberPattern = /^[1-9]\d{0,11}$/;

const entryColumns = `order_id, kind, delivered_at, expires_at,
  orders!inner (number, status, product_name, duration_days, warranty_days)`;

export async function listVaultEntries() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("vault_entries")
    .select(entryColumns)
    .order("delivered_at", { ascending: false })
    .limit(VAULT_LIST_LIMIT);
  if (error) throw new Error(`Couldn't load the vault: ${error.message}`);
  return data;
}
export type VaultListEntry = Awaited<ReturnType<typeof listVaultEntries>>[number];

// One entry by its order's number. Someone else's is null, the same as none.
export async function getVaultEntry(number: string) {
  if (!orderNumberPattern.test(number)) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("vault_entries")
    .select(`${entryColumns}, setup_instructions, warranty_warning`)
    .eq("orders.number", Number(number))
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the vault entry: ${error.message}`);
  return data;
}
