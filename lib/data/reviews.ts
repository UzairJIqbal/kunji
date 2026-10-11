import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

// Reviews as the policy gives them to a signed-in viewer: a customer gets
// their own, hidden or not; an admin gets every one.

const ADMIN_LIST_LIMIT = 100;

// The customer's review of one order, if they've written it.
export async function getOrderReview(orderId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, updated_at, hidden_at")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the review: ${error.message}`);
  return data;
}
export type OrderReview = NonNullable<Awaited<ReturnType<typeof getOrderReview>>>;

// Newest first, hidden ones included, with the order and product they're on.
export async function listAdminReviews() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      `id, rating, comment, reviewer_name, duration_days, created_at, updated_at, hidden_at, hidden_reason,
       orders!inner (number), products!inner (name)`,
    )
    .order("created_at", { ascending: false })
    .limit(ADMIN_LIST_LIMIT);
  if (error) throw new Error(`Couldn't load the reviews: ${error.message}`);
  return data.map(({ orders, products, ...review }) => ({
    ...review,
    orderNumber: orders.number,
    productName: products.name,
  }));
}
export type AdminReview = Awaited<ReturnType<typeof listAdminReviews>>[number];
