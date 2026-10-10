import "server-only";

import { auth } from "@clerk/nextjs/server";
import { idSchema } from "@/lib/catalogue";
import { createServerSupabase } from "@/lib/supabase/server";

// Read as the signed-in customer, so the plans and payment_accounts policies
// decide what checkout can offer: priced plans, active accounts.

const PAYMENT_ACCOUNT_LIMIT = 20;

export async function getCheckout(planId: string) {
  if (!idSchema.safeParse(planId).success) return null;
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = await createServerSupabase();
  const [plan, profile] = await Promise.all([
    supabase
      .from("plans")
      .select(
        `id, duration_days, warranty_days, sell_price,
         products!inner (slug, name, account_type, needs_activation_email, sold_out, active)`,
      )
      .eq("id", planId)
      .maybeSingle(),
    // The policy shows an admin every profile; this picks out the one
    // checking out. It decides nothing about who may see what.
    supabase
      .from("customer_profiles")
      .select("whatsapp")
      .eq("clerk_user_id", userId)
      .maybeSingle(),
  ]);
  if (plan.error) throw new Error(`Couldn't load the plan: ${plan.error.message}`);
  if (profile.error) throw new Error(`Couldn't load your profile: ${profile.error.message}`);

  const data = plan.data;
  // An admin can see hidden and unpriced plans; neither can be ordered.
  if (!data || data.sell_price === null || !data.products.active) return null;
  return {
    plan: { ...data, sell_price: data.sell_price },
    product: data.products,
    savedWhatsapp: profile.data?.whatsapp ?? null,
  };
}

// Only active accounts are offered to pay into. The policy already hides
// switched-off ones from customers; an admin testing checkout sees them too,
// so they're left out here by choice, not for security.
export async function listPayableAccounts() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("payment_accounts")
    .select("id, method, account_title, account_number, bank_name")
    .eq("active", true)
    .order("created_at")
    .limit(PAYMENT_ACCOUNT_LIMIT);
  if (error) throw new Error(`Couldn't load payment accounts: ${error.message}`);
  return data;
}
