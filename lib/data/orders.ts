import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/order-status";

// No `where customer_id = …` anywhere here. Which orders come back is the
// orders policy's decision; if the list ever shows someone else's order, the
// policy is the bug. Nothing is cached, so a status is always the current one.

const ORDER_LIST_LIMIT = 50;

export async function listOrders() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select("id, number, status, price, product_name, duration_days, created_at")
    .order("created_at", { ascending: false })
    .limit(ORDER_LIST_LIMIT);
  if (error) throw new Error(`Couldn't load orders: ${error.message}`);
  return data;
}

export type StatusCounts =
  | { ok: true; counts: { status: OrderStatus; count: number }[] }
  | { ok: false; reason: "not_admin" };

// The database refuses this to anyone not in the admins table.
export async function getOrderStatusCounts(): Promise<StatusCounts> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("order_status_counts");
  if (error?.code === "42501") return { ok: false, reason: "not_admin" };
  if (error) throw new Error(`Couldn't count orders: ${error.message}`);
  return {
    ok: true,
    counts: data.map((row) => ({ status: row.order_status, count: row.order_count })),
  };
}
