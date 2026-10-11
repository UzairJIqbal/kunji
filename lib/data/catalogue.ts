import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

// Read with the admin's own session. Hidden products and supplier details come
// back because the policies let an admin see them, not because of anything
// here; filtering by id below picks a row, it doesn't decide access.

const PRODUCT_LIST_LIMIT = 200;
const PLANS_PER_PRODUCT_LIMIT = 50;

export async function listProductsForAdmin() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, active, sold_out, plans (id, plan_supplier_details (price_checked_at))")
    .order("name")
    .limit(PRODUCT_LIST_LIMIT)
    .limit(PLANS_PER_PRODUCT_LIMIT, { referencedTable: "plans" });
  if (error) throw new Error(`Couldn't load products: ${error.message}`);
  return data;
}

export async function getProductForAdmin(productId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, slug, name, category, description, setup_instructions, warranty_warning, account_type,
       plan_note, needs_activation_email, image_path, active, sold_out,
       plans (id, duration_days, warranty_days, sell_price,
         plan_supplier_details (supplier_price, margin, numastore_url, price_checked_at))`,
    )
    .eq("id", productId)
    .order("duration_days", { referencedTable: "plans" })
    .order("created_at", { referencedTable: "plans" })
    .limit(PLANS_PER_PRODUCT_LIMIT, { referencedTable: "plans" })
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the product: ${error.message}`);
  return data;
}

// The categories already in use, for the form to suggest. Free text in the
// database; suggesting keeps "Streaming" from also becoming "streaming ".
export async function listCategories(): Promise<string[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("category")
    .order("category")
    .limit(PRODUCT_LIST_LIMIT);
  if (error) throw new Error(`Couldn't load categories: ${error.message}`);
  return [...new Set(data.map((row) => row.category))];
}
