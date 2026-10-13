import "server-only";

import { connection } from "next/server";
import { cache } from "react";
import { paymentMethods, type PaymentMethod } from "@/lib/catalogue";
import { type Rating, ratingAverage } from "@/lib/reviews";
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
      `id, slug, name, category, account_type, image_path, sold_out, created_at,
       plans!inner (id, duration_days, warranty_days, sell_price)`,
    )
    .order("category")
    .order("name")
    .limit(CATALOGUE_LIMIT)
    .limit(PLANS_PER_PRODUCT_LIMIT, { referencedTable: "plans" });
  if (error) throw new Error(`Couldn't load the catalogue: ${error.message}`);
  const [ratings, instant] = await Promise.all([
    readRatings(data.map((product) => product.id)),
    readInstantPlans(data.flatMap((product) => product.plans.map((plan) => plan.id))),
  ]);
  return data.map((product) => ({
    ...product,
    plans: withInstant(priced(product.plans), instant),
    rating: ratings.get(product.id) ?? NO_RATING,
  }));
}

// ───────────────────────────── Stock ─────────────────────────────

// Which plans have a stocked login waiting, and when the one that runs out
// first stops working. Only that: the database function never says how many,
// and the stock table itself isn't readable by the public at all.
async function readInstantPlans(planIds: string[]): Promise<Map<string, string>> {
  if (planIds.length === 0) return new Map();
  const supabase = createPublicSupabase();
  const { data, error } = await supabase.rpc("instant_plans", { p_plan_ids: planIds });
  if (error) throw new Error(`Couldn't load delivery times: ${error.message}`);
  return new Map(data.map((row) => [row.plan_id, row.least_expires_at]));
}

function withInstant<T extends { id: string }>(plans: T[], instant: Map<string, string>) {
  return plans.map((plan) => ({ ...plan, instant_until: instant.get(plan.id) ?? null }));
}

// One plan, for checkout.
export async function getPlanInstantUntil(planId: string): Promise<string | null> {
  return (await readInstantPlans([planId])).get(planId) ?? null;
}

// ───────────────────────────── Ratings ─────────────────────────────

const NO_RATING: Rating = { average: null, count: 0 };

// Counted from the visible reviews as this request reads them (the view
// leaves hidden ones out), then averaged here to one decimal, never up.
async function readRatings(productIds: string[]): Promise<Map<string, Rating>> {
  if (productIds.length === 0) return new Map();
  const supabase = createPublicSupabase();
  const { data, error } = await supabase
    .from("product_ratings")
    .select("product_id, review_count, rating_total")
    .in("product_id", productIds)
    .limit(productIds.length);
  if (error) throw new Error(`Couldn't load the ratings: ${error.message}`);
  return new Map(
    data.flatMap(({ product_id, review_count, rating_total }) =>
      product_id === null || !review_count
        ? []
        : [[product_id, { average: ratingAverage(rating_total ?? 0, review_count), count: review_count }]],
    ),
  );
}

const REVIEW_LIMIT = 50;

// A product's visible reviews, newest first: the policy hides the rest from
// the public. The plan is the one the reviewer bought, copied when they wrote.
export async function listProductReviews(productId: string) {
  await connection();
  const supabase = createPublicSupabase();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, reviewer_name, rating, comment, duration_days, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(REVIEW_LIMIT);
  if (error) throw new Error(`Couldn't load the reviews: ${error.message}`);
  return data;
}
export type ProductReview = Awaited<ReturnType<typeof listProductReviews>>[number];

export async function getProductRating(productId: string): Promise<Rating> {
  await connection();
  return (await readRatings([productId])).get(productId) ?? NO_RATING;
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
      `id, slug, name, category, description, account_type, plan_note,
       needs_activation_email, image_path, sold_out, created_at,
       plans!inner (id, duration_days, warranty_days, sell_price)`,
    )
    .eq("slug", slug)
    .order("duration_days", { referencedTable: "plans" })
    .order("sell_price", { referencedTable: "plans" })
    .limit(PLANS_PER_PRODUCT_LIMIT, { referencedTable: "plans" })
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the product: ${error.message}`);
  if (!data) return null;
  const instant = await readInstantPlans(data.plans.map((plan) => plan.id));
  return { ...data, plans: withInstant(priced(data.plans), instant) };
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
