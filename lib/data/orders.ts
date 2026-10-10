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
    .select("id, number, status, price, product_name, duration_days, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(ORDER_LIST_LIMIT);
  if (error) throw new Error(`Couldn't load orders: ${error.message}`);
  return data;
}

const EVENT_LIMIT = 50;
const orderNumberPattern = /^[1-9]\d{0,11}$/;

// One order with its timeline and its proof, if the policy lets this viewer
// see it. Someone else's order is simply not there: null, the same as an
// order number that never existed.
export async function getOrder(number: string) {
  if (!orderNumberPattern.test(number)) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, number, status, price, product_name, duration_days, warranty_days,
       activation_email, expires_at, created_at,
       order_events (id, to_status, created_at),
       payments (method, transaction_id, sender_number, created_at)`,
    )
    .eq("number", Number(number))
    // Moves made in one transaction share a time; the ID keeps their order.
    .order("id", { referencedTable: "order_events" })
    .limit(EVENT_LIMIT, { referencedTable: "order_events" })
    .order("created_at", { referencedTable: "payments", ascending: false })
    .limit(1, { referencedTable: "payments" })
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the order: ${error.message}`);
  if (!data) return null;
  const { payments, ...order } = data;
  return { ...order, payment: payments[0] ?? null };
}

// The receipt's path, read under the payments policy. Only the order's own
// customer, or an admin, gets one back.
export async function getReceiptPath(number: string) {
  if (!orderNumberPattern.test(number)) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select("payments (receipt_path, created_at)")
    .eq("number", Number(number))
    .order("created_at", { referencedTable: "payments", ascending: false })
    .limit(1, { referencedTable: "payments" })
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the receipt: ${error.message}`);
  return data?.payments[0]?.receipt_path ?? null;
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
