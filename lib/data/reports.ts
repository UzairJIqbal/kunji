import "server-only";

import type { OrderReport, PeriodRange, ProductReport, WaitingTime } from "@/lib/reports";
import { createServerSupabase } from "@/lib/supabase/server";

// The report functions refuse anyone but an admin (42501); that refusal comes
// back as "not an admin", any other failure is thrown.
export type Report<T> = { ok: true; rows: T } | { ok: false; reason: "not_admin" };

function bounds(range: PeriodRange) {
  return {
    ...(range.from && { p_from: range.from.toISOString() }),
    ...(range.to && { p_to: range.to.toISOString() }),
  };
}

export async function getReport(
  range: PeriodRange,
): Promise<Report<{ products: ProductReport[]; waits: WaitingTime[] }>> {
  const supabase = await createServerSupabase();
  const [products, waits] = await Promise.all([
    supabase
      .rpc("report_products", bounds(range))
      .select(
        "product_id, product_name, delivered, revenue, supplier_cost, planned_margin, warranty_refunds, warranty_refund_amount, claim_replacements, paid_replacements, paid_replacement_cost, out_of_stock_refunds, out_of_stock_refund_amount, rejected_refunds, rejected_refund_amount",
      ),
    supabase
      .rpc("report_waiting_times", bounds(range))
      .select("step, orders, median_seconds, slowest_seconds, over_30_minutes"),
  ]);
  if (products.error?.code === "42501" || waits.error?.code === "42501") return { ok: false, reason: "not_admin" };
  if (products.error) throw new Error(`Couldn't read the sales report: ${products.error.message}`);
  if (waits.error) throw new Error(`Couldn't read the waiting times: ${waits.error.message}`);
  return { ok: true, rows: { products: products.data, waits: waits.data } };
}

// Every order placed in the period, for the CSV. The API caps how many rows
// one read returns, so the full count is asked for too: a file missing orders
// fails rather than downloading short.
export async function getOrdersReport(range: PeriodRange): Promise<Report<OrderReport[]>> {
  const supabase = await createServerSupabase();
  const { data, error, count } = await supabase
    .rpc("report_orders", bounds(range), { count: "exact" })
    .select("number, placed_at, product_name, duration_days, price, supplier_cost, refund, replacement_cost, status");
  if (error?.code === "42501") return { ok: false, reason: "not_admin" };
  if (error) throw new Error(`Couldn't read the orders report: ${error.message}`);
  if (count === null || count !== data.length) {
    throw new Error(`The orders report returned ${data.length} of ${count ?? "an unknown number of"} orders`);
  }
  return { ok: true, rows: data };
}
