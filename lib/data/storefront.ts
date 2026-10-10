import "server-only";

import { connection } from "next/server";
import { cache } from "react";
import { paymentMethods, type PaymentMethod } from "@/lib/catalogue";
import { createPublicSupabase } from "@/lib/supabase/public";

// Prices are read on every request, never cached into a page: connection()
// keeps all of this out of the prerendered shell.
//
// `plans!inner` lists a product only if it has a plan the public can see. The
// plans policy already hides any plan without a price, so a product with
// nothing to buy has no price or facts to show and stays off the storefront.

const CATALOGUE_LIMIT = 200;
const PLANS_PER_PRODUCT_LIMIT = 50;

// The policy only shows priced plans, but the column is nullable for the
// seller's half-entered ones; this tells TypeScript what the policy guarantees.
function priced<T extends { sell_price: number | null }>(
  plans: T[],
): (T & { sell_price: number })[] {
  return plans.flatMap((plan) =>
    plan.sell_price === null ? [] : [{ ...plan, sell_price: plan.sell_price }],
  );
}

export async function listCatalogue() {
  await connection();
  const supabase = createPublicSupabase();
  const { data, error } = await supabase
    .from("products")
    .select(
      `slug, name, category, account_type, image_path, sold_out, created_at,
       plans!inner (duration_days, warranty_days, sell_price)`,
    )
    .order("category")
    .order("name")
    .limit(CATALOGUE_LIMIT)
    .limit(PLANS_PER_PRODUCT_LIMIT, { referencedTable: "plans" });
  if (error) throw new Error(`Couldn't load the catalogue: ${error.message}`);
  return data.map((product) => ({ ...product, plans: priced(product.plans) }));
}

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Cached per request, so the page and its title share one query.
export const getProduct = cache(async (slug: string) => {
  await connection();
  // Anything that can't be a slug can't be a product; no need to ask.
  if (slug.length > 80 || !slugPattern.test(slug)) return null;

  const supabase = createPublicSupabase();
  const { data, error } = await supabase
    .from("products")
    .select(
      `slug, name, category, description, account_type, plan_note,
       needs_activation_email, image_path, sold_out, created_at,
       plans!inner (id, duration_days, warranty_days, sell_price)`,
    )
    .eq("slug", slug)
    .order("duration_days", { referencedTable: "plans" })
    .order("sell_price", { referencedTable: "plans" })
    .limit(PLANS_PER_PRODUCT_LIMIT, { referencedTable: "plans" })
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the product: ${error.message}`);
  return data && { ...data, plans: priced(data.plans) };
});

// The methods the seller takes right now, from their active accounts. Only the
// method is read; the account details belong to checkout.
export async function listAcceptedPaymentMethods(): Promise<PaymentMethod[]> {
  await connection();
  const supabase = createPublicSupabase();
  const { data, error } = await supabase.from("payment_accounts").select("method").limit(50);
  if (error) throw new Error(`Couldn't load payment methods: ${error.message}`);
  const taken = new Set(data.map((row) => row.method));
  return paymentMethods.filter((method) => taken.has(method));
}
