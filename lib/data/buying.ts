import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

// Admin views. The supplier tables are readable by admins only, so a customer
// calling this would get no supplier details at all; the page still checks
// viewerSeesAdminRows() before showing anything.

const LIST_LIMIT = 100;

// Every order at paid, oldest approval first. Read from the paid event, so
// how long it has waited comes from when the move was recorded, not a stored
// number. An order is paid at most once: it can only leave for bought or
// refunded, and neither leads back.
export async function listOrdersToBuy() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("order_events")
    .select(
      `created_at,
       orders!inner (id, number, price, product_name, duration_days, activation_email,
         plans (product_id, plan_supplier_details (supplier_price, numastore_url)),
         supply_failures (created_at),
         payments (method, sender_number, created_at))`,
    )
    .eq("to_status", "paid")
    .eq("orders.status", "paid")
    .order("created_at", { ascending: true })
    .order("created_at", { referencedTable: "orders.payments", ascending: false })
    .limit(1, { referencedTable: "orders.payments" })
    .limit(LIST_LIMIT);
  if (error) throw new Error(`Couldn't load the buy list: ${error.message}`);

  const rows = data.map(({ created_at, orders }) => {
    const { plans, supply_failures, payments, ...order } = orders;
    return {
      ...order,
      paidAt: created_at,
      productId: plans.product_id,
      supplier: plans.plan_supplier_details,
      unsuppliable: supply_failures.length > 0,
      payment: payments[0] ?? null,
    };
  });
  // Numastore couldn't supply these: the money is owed back, not an item.
  return {
    toBuy: rows.filter((row) => !row.unsuppliable),
    toRefund: rows.filter((row) => row.unsuppliable),
  };
}
export type BuyRow = Awaited<ReturnType<typeof listOrdersToBuy>>["toBuy"][number];

// Which Kunji order already used a numastore order number, to name it when
// the database refuses a second use. Normalised the way the database stores it.
export async function findOrderBySupplierNumber(supplierOrderNumber: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("supplier_purchases")
    .select("orders (number)")
    .eq("supplier_order_number", supplierOrderNumber.replace(/\s/g, "").toUpperCase())
    .maybeSingle();
  if (error) return null;
  return data?.orders.number ?? null;
}

// Every order at bought, waiting for the seller to paste what numastore
// delivered. Oldest order first: it's the one the customer has waited
// longest for.
export async function listOrdersToDeliver() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, number, product_name, duration_days, activation_email,
       plans (products (account_type)),
       supplier_purchases!inner (supplier_order_number, created_at)`,
    )
    .eq("status", "bought")
    .order("created_at", { ascending: true })
    .limit(LIST_LIMIT);
  if (error) throw new Error(`Couldn't load the delivery list: ${error.message}`);

  // A bought order has exactly one purchase: the database won't move it to
  // bought without one, and the inner join drops none.
  return data.map(({ plans, supplier_purchases, ...order }) => ({
    ...order,
    accountType: plans.products.account_type,
    purchase: supplier_purchases[0] ?? null,
  }));
}
export type DeliverRow = Awaited<ReturnType<typeof listOrdersToDeliver>>[number];
