"use server";

import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { type FormState, formValues, idSchema, refusal } from "@/lib/catalogue";
import {
  MAX_RECEIPT_BYTES,
  RECEIPT_BUCKET,
  activationEmailSchema,
  checkoutSchema,
  proofSchema,
} from "@/lib/checkout";
import { detectImageType, imageContentType } from "@/lib/image-type";
import { createServerSupabase } from "@/lib/supabase/server";

// Every write runs as the signed-in customer, and the policies and triggers
// decide: the price comes from the plan in the database, an order can only be
// the customer's own, and proof only ever moves an order to verifying.

type DbError = { code?: string; message: string };

function failed(message: string, prev: FormState, fieldErrors: FormState["fieldErrors"] = {}): FormState {
  return { ok: false, message, fieldErrors, version: prev.version };
}

const MALFORMED = "Not sent: the request was malformed. Reload the page and try again.";

// The database's own codes for what a customer can run into (see the
// checkout migration). Anything else is unexpected and said as it is.
function orderFailure(error: DbError, prev: FormState): FormState {
  switch (error.code) {
    case "KJ001":
      return failed(
        "You already have 3 orders waiting for payment. Pay for one of them, or wait for one to expire, then order again.",
        prev,
      );
    case "KJ002":
      return failed("This plan can't be ordered right now. Go back to the product to see what's available.", prev);
    case "KJ003":
      return failed("Not placed. This product needs the email it will be activated on.", prev, {
        email: ["Activation email is required"],
      });
    case "KJ004":
      return failed("Not placed. A WhatsApp number is needed so we can reach you about this order.", prev, {
        whatsapp: ["WhatsApp number is required"],
      });
    case "42501":
      return failed("Not placed: sign in again and retry.", prev);
    default:
      return failed(`Not placed: ${error.message}`, prev);
  }
}

// ───────────────────────────── Placing an order ─────────────────────────────

export async function placeOrder(prev: FormState, formData: FormData): Promise<FormState> {
  const planId = idSchema.safeParse(formData.get("planId"));
  if (!planId.success) return failed(MALFORMED, prev);
  const { userId } = await auth();
  if (!userId) return failed("Not placed: sign in again and retry.", prev);

  // What to ask is the database's answer, not the form's: whether the
  // product needs an email, and whether this customer has given a number.
  const supabase = await createServerSupabase();
  const [plan, profile] = await Promise.all([
    supabase
      .from("plans")
      .select("products!inner (needs_activation_email)")
      .eq("id", planId.data)
      .maybeSingle(),
    supabase.from("customer_profiles").select("whatsapp").eq("clerk_user_id", userId).maybeSingle(),
  ]);
  if (plan.error || profile.error) {
    return failed(`Not placed: ${(plan.error ?? profile.error)?.message}`, prev);
  }
  if (!plan.data) return orderFailure({ code: "KJ002", message: "" }, prev);

  const parsed = checkoutSchema({
    email: plan.data.products.needs_activation_email,
    whatsapp: !profile.data?.whatsapp,
  }).safeParse(formValues(formData));
  if (!parsed.success) return { ...refusal(parsed.error, prev), message: "Not placed. Check the fields marked below." };

  const { data: number, error } = await supabase.rpc("place_order", {
    p_plan_id: parsed.data.planId,
    p_activation_email: parsed.data.activationEmail ?? undefined,
    p_whatsapp: parsed.data.whatsapp ?? undefined,
  });
  if (error) return orderFailure(error, prev);

  redirect(`/account/orders/${number}`);
}

// ───────────────────────────── Proof of payment ─────────────────────────────

function proofFailure(error: DbError, prev: FormState): FormState {
  switch (error.code) {
    // The unique constraint on (method, transaction_id).
    case "23505":
      return failed("Not sent. This transaction ID has already been used.", prev, {
        transactionId: ["This transaction ID has already been used"],
      });
    case "KJ005":
      return failed("This order isn't waiting for payment any more. Reload the page to see where it is.", prev);
    case "P0002":
    case "42501":
      return failed("Not sent: this order isn't yours, or it no longer exists.", prev);
    default:
      return failed(`Not sent: ${error.message}`, prev);
  }
}

export async function submitProof(
  orderId: string,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const order = idSchema.safeParse(orderId);
  const account = idSchema.safeParse(formData.get("paymentAccountId"));
  if (!order.success) return failed(MALFORMED, prev);
  if (!account.success) {
    return failed("Not sent. Choose the account you paid into.", prev, {
      paymentAccountId: ["Choose the account you paid into"],
    });
  }
  const { userId } = await auth();
  if (!userId) return failed("Not sent: sign in again and retry.", prev);

  // The account's method decides what "the number you paid from" looks like.
  const supabase = await createServerSupabase();
  const { data: paidInto, error: accountError } = await supabase
    .from("payment_accounts")
    .select("method")
    .eq("id", account.data)
    .maybeSingle();
  if (accountError) return failed(`Not sent: ${accountError.message}`, prev);
  if (!paidInto) {
    return failed("Not sent. That account isn't taking payments any more; choose another.", prev, {
      paymentAccountId: ["Choose the account you paid into"],
    });
  }

  const parsed = proofSchema(paidInto.method).safeParse(formValues(formData));
  const receipt = formData.get("receipt");
  const receiptError =
    !(receipt instanceof File) || receipt.size === 0
      ? "A screenshot of the payment is required"
      : receipt.size > MAX_RECEIPT_BYTES
        ? "The screenshot is over 5 MB"
        : null;
  if (!parsed.success || receiptError || !(receipt instanceof File)) {
    const refused = parsed.success ? null : refusal(parsed.error, prev);
    const fieldErrors = {
      ...refused?.fieldErrors,
      ...(receiptError ? { receipt: [receiptError] } : {}),
    };
    return failed("Not sent. Check the fields marked below.", prev, fieldErrors);
  }

  const bytes = new Uint8Array(await receipt.arrayBuffer());
  const ext = detectImageType(bytes);
  if (!ext) {
    return failed("Not sent. Check the fields marked below.", prev, {
      receipt: ["The screenshot must be a JPEG, PNG or WebP image"],
    });
  }

  // Uploaded first because the payment can only name a receipt that exists.
  // The folder is the customer's own; the storage policy refuses any other.
  const path = `${userId}/${randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(path, bytes, { contentType: imageContentType[ext], upsert: false });
  if (uploadError) return failed(`Not sent: the screenshot didn't upload. ${uploadError.message}`, prev);

  const { error } = await supabase.rpc("submit_payment_proof", {
    p_order_id: order.data,
    p_payment_account_id: account.data,
    p_transaction_id: parsed.data.transactionId,
    p_sender_number: parsed.data.senderNumber,
    p_receipt_path: path,
  });
  if (error) {
    // No payment names this file, so the customer may take it back. If that
    // fails too, it's an orphan in their own private folder, nothing more.
    await supabase.storage.from(RECEIPT_BUCKET).remove([path]);
    return proofFailure(error, prev);
  }

  refresh();
  return { ok: true, message: "Proof sent.", fieldErrors: {}, version: prev.version + 1 };
}

// ───────────────────────────── Fixing the activation email ─────────────────────────────

// The same order, corrected: its price and place in the queue stay. The
// orders policy only lets the customer do this while it awaits payment.
export async function fixActivationEmail(
  orderId: string,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const order = idSchema.safeParse(orderId);
  if (!order.success) return failed(MALFORMED, prev);
  const parsed = activationEmailSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ...refusal(parsed.error, prev), message: "Not saved. Check the fields marked below." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("orders")
    .update({ activation_email: parsed.data.email })
    .eq("id", order.data)
    .select("number");
  if (error) return failed(`Not saved: ${error.message}`, prev);
  if (data.length === 0) {
    return failed("Not saved: the email can only be changed while the order is waiting for payment.", prev);
  }

  redirect(`/account/orders/${data[0].number}`);
}
