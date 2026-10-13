import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

// Read with the admin's own session: stock rows come back because the policy
// lets an admin see them. The credential and its fingerprint aren't granted to
// any signed-in role, so they can't be selected here even by mistake.

const STOCKED_PLANS_LIMIT = 200;
const ITEMS_PER_PLAN_LIMIT = 200;

// Every plan that can be stocked, so a plan with none yet still has a way in.
// Counts come from the view and are merged by plan; a plan missing from it has
// no stock at all.
export async function listStockablePlans() {
  const supabase = await createServerSupabase();
  const [plans, counts] = await Promise.all([
    supabase
      .from("plans")
      .select("id, duration_days, products!inner (name)")
      .eq("products.needs_activation_email", false)
      .limit(STOCKED_PLANS_LIMIT),
    supabase
      .from("stock_by_plan")
      .select("plan_id, free, held_back, delivered, soonest_free_expires_at")
      .limit(STOCKED_PLANS_LIMIT),
  ]);
  if (plans.error) throw new Error(`Couldn't load plans: ${plans.error.message}`);
  if (counts.error) throw new Error(`Couldn't load stock: ${counts.error.message}`);
  const byPlan = new Map(counts.data.map((row) => [row.plan_id, row]));
  return plans.data.map((plan) => ({ plan, stock: byPlan.get(plan.id) ?? null }));
}

export async function getPlanForStock(planId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("plans")
    .select("id, duration_days, products!inner (id, name, needs_activation_email)")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the plan: ${error.message}`);
  return data;
}

// Free items first, the one that runs out soonest at the top, as they'll be
// sold; then the ones already delivered, latest first.
export async function listStockItems(planId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("stock_item_states")
    .select("id, supplier_order_number, cost, expires_at, created_at, used_at, held_back, orders (number)")
    .eq("plan_id", planId)
    .order("used_at", { ascending: false, nullsFirst: true })
    .order("expires_at")
    .limit(ITEMS_PER_PLAN_LIMIT);
  if (error) throw new Error(`Couldn't load the plan's stock: ${error.message}`);
  return data;
}
