import type { Database } from "@/lib/supabase/database.types";
// Relative, with its extension, so the tests can load this file directly.
import { formatRupees } from "./format.ts";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

// Colour means status or isn't there: green when it's done well, amber when
// someone is waiting, red when it went wrong, plain otherwise.
export type StatusTone = "success" | "warning" | "danger" | "plain";

// The seller sees every state, because a paid order nobody has bought yet is
// the one thing they must not forget.
export const adminStatusLabel: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  verifying: "Verifying",
  paid: "Paid",
  bought: "Bought",
  delivered: "Delivered",
  rejected: "Rejected",
  refunded: "Refunded",
  replaced: "Replaced",
};

// The customer sees paid and bought as one step: the difference is the
// seller's business, not theirs.
export const customerStatusLabel: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  verifying: "Checking your payment",
  paid: "Preparing your order",
  bought: "Preparing your order",
  delivered: "Delivered",
  rejected: "Payment rejected",
  refunded: "Refunded",
  replaced: "Replaced",
};

export const statusTone: Record<OrderStatus, StatusTone> = {
  awaiting_payment: "plain",
  verifying: "warning",
  paid: "warning",
  bought: "warning",
  delivered: "success",
  rejected: "danger",
  refunded: "plain",
  replaced: "success",
};

// ───────────────────────────── Expiry ─────────────────────────────

// Expiry isn't a status the database moves an order into: an unpaid order is
// expired once its time has passed, worked out whenever it's read. It still
// takes proof, because someone may have paid at the last minute.
export function isExpired(
  order: { status: OrderStatus; expires_at: string },
  now: Date,
): boolean {
  return order.status === "awaiting_payment" && new Date(order.expires_at) <= now;
}

// A paid order numastore couldn't supply isn't being prepared: the customer
// is owed their money, and is told so until the refund is recorded.
export function customerOrderStatus(
  order: { status: OrderStatus; expires_at: string; price: number; outOfStock: boolean },
  now: Date,
): { label: string; tone: StatusTone } {
  if (isExpired(order, now)) return { label: "Expired", tone: "plain" };
  if (order.status === "paid" && order.outOfStock) {
    return {
      label: `This item is out of stock. Your refund of ${formatRupees(order.price)} is on its way.`,
      tone: "warning",
    };
  }
  return { label: customerStatusLabel[order.status], tone: statusTone[order.status] };
}

// What each recorded move means to the customer, for their order's timeline.
// The seller buying the item is left out, as with the status: to the customer
// it's one step, "preparing".
export const customerEventLabel: Record<OrderStatus, string | null> = {
  awaiting_payment: "Order placed",
  verifying: "Payment proof submitted",
  paid: "Payment confirmed",
  bought: null,
  delivered: "Delivered to your vault",
  rejected: "Payment rejected",
  refunded: "Refunded",
  replaced: "Replacement delivered",
};
