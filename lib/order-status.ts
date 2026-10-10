import type { Database } from "@/lib/supabase/database.types";

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
