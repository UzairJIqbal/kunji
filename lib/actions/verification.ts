"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { MALFORMED, decisionFailure, failed, saved } from "@/lib/actions/results";
import { buyNeededPing } from "@/lib/buying";
import { type FormState, formValues, idSchema, refusal } from "@/lib/catalogue";
import { ntfyEnv } from "@/lib/env";
import { pingSeller } from "@/lib/ntfy";
import { createServerSupabase } from "@/lib/supabase/server";
import { awaySchema, refundSchema, rejectionSchema } from "@/lib/verification";

// Each decision is one database function: it checks the caller is an admin,
// locks the order, and makes the move, which the order's own trigger records
// with who made it. The browser names the order and nothing else it could lie
// about; the price and the current state are the database's.

export async function approvePayment(orderId: string, prev: FormState): Promise<FormState> {
  const order = idSchema.safeParse(orderId);
  if (!order.success) return failed(MALFORMED, prev);

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("approve_payment", { p_order_id: order.data });
  if (error) return decisionFailure(error, prev);

  // The next step is buying it, so it goes to the seller's phone now. After
  // the response, and never able to undo the approval.
  after(async () => {
    const { data: approved, error: readError } = await supabase
      .from("orders")
      .select("number, price")
      .eq("id", order.data)
      .single();
    if (readError) {
      console.error(`Ping skipped: couldn't read the order (${readError.code ?? "no code"})`);
      return;
    }
    await pingSeller(buyNeededPing(approved, ntfyEnv().siteUrl));
  });

  refresh();
  return saved("Approved.", prev);
}

export async function rejectPayment(orderId: string, prev: FormState, formData: FormData): Promise<FormState> {
  const order = idSchema.safeParse(orderId);
  if (!order.success) return failed(MALFORMED, prev);
  const rejection = rejectionSchema.safeParse(formValues(formData));
  if (!rejection.success) return refusal(rejection.error, prev);

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("reject_payment", { p_order_id: order.data, p_reason: rejection.data.reason });
  if (error) return decisionFailure(error, prev);

  refresh();
  return saved("Rejected.", prev);
}

export async function refundRejectedOrder(
  orderId: string,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const order = idSchema.safeParse(orderId);
  if (!order.success) return failed(MALFORMED, prev);
  const refund = refundSchema.safeParse(formValues(formData));
  if (!refund.success) return refusal(refund.error, prev);

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("refund_rejected_order", {
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
  if (error) return decisionFailure(error, prev);

  refresh();
  return saved("Refund recorded.", prev);
}

// ───────────────────────────── Away ─────────────────────────────

// The settings table has exactly one row, keyed true; the update policy
// decides whether this viewer may change it.
export async function switchAwayOn(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = awaySchema.safeParse(formValues(formData));
  if (!parsed.success) return refusal(parsed.error, prev);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("store_settings")
    .update({ away: true, back_at: parsed.data.backAt })
    .eq("id", true)
    .select("away");
  if (error) return decisionFailure(error, prev);
  if (data.length === 0) return failed("Not saved: this account isn't an admin.", prev);

  refresh();
  return saved("Away is on.", prev);
}

export async function switchAwayOff(prev: FormState): Promise<FormState> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("store_settings")
    .update({ away: false })
    .eq("id", true)
    .select("away");
  if (error) return decisionFailure(error, prev);
  if (data.length === 0) return failed("Not saved: this account isn't an admin.", prev);

  refresh();
  return saved("Away is off.", prev);
}
