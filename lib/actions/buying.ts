"use server";

import { refresh } from "next/cache";
import { MALFORMED, decisionFailure, failed, saved } from "@/lib/actions/results";
import { boughtSchema } from "@/lib/buying";
import { type FormState, formValues, idSchema, refusal } from "@/lib/catalogue";
import { findOrderBySupplierNumber } from "@/lib/data/buying";
import { createServerSupabase } from "@/lib/supabase/server";
import { refundSchema } from "@/lib/verification";

// As with approving: each step is one database function that checks the
// caller is an admin, locks the order and makes the move. The browser names
// the order and says what the seller typed; the state is the database's.

const UNSUPPLIABLE = "This order is recorded as one numastore can't supply. Record its refund instead.";

export async function markBought(orderId: string, prev: FormState, formData: FormData): Promise<FormState> {
  const order = idSchema.safeParse(orderId);
  if (!order.success) return failed(MALFORMED, prev);
  const bought = boughtSchema.safeParse(formValues(formData));
  if (!bought.success) return refusal(bought.error, prev);

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("mark_order_bought", {
    p_order_id: order.data,
    p_supplier_order_number: bought.data.supplierOrderNumber,
    p_amount_paid: bought.data.amountPaid,
  });
  // One numastore order, one Kunji order: the unique key says so.
  if (error?.code === "23505") {
    const usedOn = await findOrderBySupplierNumber(bought.data.supplierOrderNumber);
    return failed(
      usedOn === null
        ? "Not saved: that numastore order number is already used on another order."
        : `Not saved: that numastore order number is already used on order #${usedOn}.`,
      prev,
      { supplierOrderNumber: ["Already used"] },
    );
  }
  if (error?.code === "23514") {
    return failed("Not saved: that numastore order number is too long once spaces are taken out.", prev, {
      supplierOrderNumber: ["Too long"],
    });
  }
  if (error?.code === "KJ008") return failed(UNSUPPLIABLE, prev);
  if (error) return decisionFailure(error, prev);

  refresh();
  return saved("Bought.", prev);
}

export async function cannotSupply(orderId: string, prev: FormState): Promise<FormState> {
  const order = idSchema.safeParse(orderId);
  if (!order.success) return failed(MALFORMED, prev);

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("record_cannot_supply", { p_order_id: order.data });
  if (error) return decisionFailure(error, prev);

  refresh();
  return saved("Marked sold out. The refund is waiting under refunds to send.", prev);
}

export async function refundUnsuppliedOrder(
  orderId: string,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const order = idSchema.safeParse(orderId);
  if (!order.success) return failed(MALFORMED, prev);
  const refund = refundSchema.safeParse(formValues(formData));
  if (!refund.success) return refusal(refund.error, prev);

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("refund_unsupplied_order", {
    p_order_id: order.data,
    p_amount: refund.data.amount,
    p_method: refund.data.method,
    p_reference: refund.data.reference,
  });
  // The cap is held by the database, because it knows the price.
  if (error?.code === "23514") {
    return failed("Not saved. A refund can't be more than the order's price.", prev, {
      amount: ["More than the order's price"],
    });
  }
  if (error?.code === "KJ007") return failed("Not saved: this order has no payment to refund to.", prev);
  if (error?.code === "KJ008") return failed("Not saved: this order isn't recorded as one numastore can't supply.", prev);
  if (error) return decisionFailure(error, prev);

  refresh();
  return saved("Refund recorded.", prev);
}
