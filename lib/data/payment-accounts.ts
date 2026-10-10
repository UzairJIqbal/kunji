import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

const PAYMENT_ACCOUNT_LIMIT = 50;

// An admin sees switched-off accounts too; a customer would see only the
// active ones. That's the payment_accounts policy, not this query.
export async function listPaymentAccounts() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("payment_accounts")
    .select("id, method, account_title, account_number, bank_name, active")
    .order("created_at")
    .limit(PAYMENT_ACCOUNT_LIMIT);
  if (error) throw new Error(`Couldn't load payment accounts: ${error.message}`);
  return data;
}
