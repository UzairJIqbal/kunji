"use server";

import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { RevealResult } from "@/lib/actions/vault";
import { MALFORMED, failed, saved } from "@/lib/actions/results";
import { type FormState, formValues, idSchema, refusal } from "@/lib/catalogue";
import { detectImageType, imageContentType } from "@/lib/image-type";
import { createServerSupabase } from "@/lib/supabase/server";
import { credentialSchema, parseCredential, serializeCredential } from "@/lib/vault";
import { decryptCredential, encryptCredential } from "@/lib/vault-crypto";
import { refundSchema } from "@/lib/verification";
import {
  MAX_SCREENSHOT_BYTES,
  TICKET_SCREENSHOT_BUCKET,
  claimSchema,
  messageSchema,
  replacementPurchaseSchema,
  ticketSchema,
} from "@/lib/warranty";

// Every write runs as the signed-in viewer. The database decides whether the
// warranty still runs, whether the ticket is still open, and every move a
// decision makes; the browser names a ticket and says what it wants.
// Replacement credentials follow the vault's rules: encrypted here, against
// the order's id, before the database sees them, and no failure on that path
// repeats a database error's text.

type DbError = { code?: string; message: string };

// The codes the ticket functions raise (see the warranty tickets migration).
function ticketFailure(error: DbError, prev: FormState): FormState {
  switch (error.code) {
    case "42501":
      return failed("Not saved: this account isn't an admin.", prev);
    case "P0002":
      return failed("Not saved: this ticket no longer exists.", prev);
    case "KJ006":
      return failed("This ticket has already moved on. Reload to see where it is.", prev);
    default:
      return failed("Not saved. Nothing was changed; try again.", prev);
  }
}

// ───────────────────────────── The customer's side ─────────────────────────────

export async function openTicket(orderId: string, prev: FormState, formData: FormData): Promise<FormState> {
  const order = idSchema.safeParse(orderId);
  if (!order.success) return failed(MALFORMED, prev);
  const { userId } = await auth();
  if (!userId) return failed("Not sent: sign in again and retry.", prev);

  const parsed = ticketSchema.safeParse(formValues(formData));
  const screenshot = formData.get("screenshot");
  const hasScreenshot = screenshot instanceof File && screenshot.size > 0;
  const screenshotError =
    hasScreenshot && screenshot.size > MAX_SCREENSHOT_BYTES ? "The screenshot is over 5 MB" : null;
  if (!parsed.success || screenshotError) {
    const refused = parsed.success ? null : refusal(parsed.error, prev);
    return failed("Not sent. Check the fields marked below.", prev, {
      ...refused?.fieldErrors,
      ...(screenshotError ? { screenshot: [screenshotError] } : {}),
    });
  }

  const supabase = await createServerSupabase();
  const { data: target, error: readError } = await supabase
    .from("orders")
    .select("number")
    .eq("id", order.data)
    .maybeSingle();
  if (readError || !target) return failed("Not sent: this order isn't yours, or it no longer exists.", prev);

  // Uploaded first because the ticket can only name a file that exists. The
  // folder is the customer's own; the storage policy refuses any other.
  let path: string | null = null;
  if (hasScreenshot) {
    const bytes = new Uint8Array(await screenshot.arrayBuffer());
    const ext = detectImageType(bytes);
    if (!ext) {
      return failed("Not sent. Check the fields marked below.", prev, {
        screenshot: ["The screenshot must be a JPEG, PNG or WebP image"],
      });
    }
    path = `${userId}/${randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(TICKET_SCREENSHOT_BUCKET)
      .upload(path, bytes, { contentType: imageContentType[ext], upsert: false });
    if (uploadError) return failed("Not sent: the screenshot didn't upload. Try again.", prev);
  }

  const { error } = await supabase.from("warranty_tickets").insert({
    order_id: order.data,
    customer_id: userId,
    reason: parsed.data.reason,
    note: parsed.data.note,
    screenshot_path: path,
  });
  if (error) {
    // No ticket names the file, so the customer may take it back.
    if (path) await supabase.storage.from(TICKET_SCREENSHOT_BUCKET).remove([path]);
    switch (error.code) {
      case "KJ009":
        return failed("This order's warranty has ended. Message us on WhatsApp instead.", prev);
      case "23505":
        return failed("There's already an open problem report on this order. Reply to it below.", prev);
      case "KJ006":
        return failed("This order hasn't been delivered, so there's nothing to report yet.", prev);
      case "42501":
      case "23503":
        return failed("Not sent: this order isn't yours, or it no longer exists.", prev);
      default:
        return failed("Not sent. Try again, or message us on WhatsApp.", prev);
    }
  }

  redirect(`/account/orders/${target.number}`);
}

// Either side. The database fills in who wrote it and which side they're on,
// and refuses a closed ticket; the customer id only routes the row to the
// ticket's own customer, and the trigger checks it matches.
export async function sendTicketMessage(ticketId: string, prev: FormState, formData: FormData): Promise<FormState> {
  const ticket = idSchema.safeParse(ticketId);
  if (!ticket.success) return failed(MALFORMED, prev);
  const parsed = messageSchema.safeParse(formValues(formData));
  if (!parsed.success) return refusal(parsed.error, prev);

  const supabase = await createServerSupabase();
  const { data: target, error: readError } = await supabase
    .from("warranty_tickets")
    .select("customer_id")
    .eq("id", ticket.data)
    .maybeSingle();
  if (readError || !target) return failed("Not sent: this ticket no longer exists.", prev);

  const { error } = await supabase
    .from("ticket_messages")
    .insert({ ticket_id: ticket.data, customer_id: target.customer_id, body: parsed.data.body });
  if (error?.code === "KJ006") return failed("This ticket is closed. Message us on WhatsApp instead.", prev);
  if (error) return failed("Not sent. Try again.", prev);

  refresh();
  return saved("Sent.", prev);
}

// ───────────────────────────── The seller's side ─────────────────────────────

export async function claimTicket(ticketId: string, prev: FormState, formData: FormData): Promise<FormState> {
  const ticket = idSchema.safeParse(ticketId);
  if (!ticket.success) return failed(MALFORMED, prev);
  const parsed = claimSchema.safeParse(formValues(formData));
  if (!parsed.success) return refusal(parsed.error, prev);

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("claim_ticket", {
    p_ticket_id: ticket.data,
    p_supplier_reference: parsed.data.reference,
  });
  if (error) return ticketFailure(error, prev);

  refresh();
  return saved("Marked claimed.", prev);
}

// The order a ticket is on: the credential is sealed against its id, as the
// one it replaces was.
async function ticketOrderId(ticketId: string): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("warranty_tickets").select("order_id").eq("id", ticketId).maybeSingle();
  return error || !data ? null : data.order_id;
}

const NOT_REPLACED = "Not replaced. Nothing was saved; try again.";

export async function replaceFromClaim(ticketId: string, prev: FormState, formData: FormData): Promise<FormState> {
  const ticket = idSchema.safeParse(ticketId);
  if (!ticket.success) return failed(MALFORMED, prev);
  const credential = credentialSchema.safeParse(formValues(formData));
  if (!credential.success) return refusal(credential.error, prev);
  const orderId = await ticketOrderId(ticket.data);
  if (!orderId) return failed("Not saved: this ticket no longer exists.", prev);

  let sealed: string;
  try {
    sealed = encryptCredential(orderId, serializeCredential(credential.data));
  } catch {
    return failed("Not replaced: the vault key isn't set up on the server.", prev);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("replace_from_claim", {
    p_ticket_id: ticket.data,
    p_kind: credential.data.kind,
    p_credential: sealed,
  });
  if (error?.code === "42501" || error?.code === "P0002" || error?.code === "KJ006") {
    return ticketFailure(error, prev);
  }
  if (error) return failed(NOT_REPLACED, prev);

  refresh();
  return saved("Replaced. The new credential is in the customer's vault.", prev);
}

export async function replaceByPurchase(ticketId: string, prev: FormState, formData: FormData): Promise<FormState> {
  const ticket = idSchema.safeParse(ticketId);
  if (!ticket.success) return failed(MALFORMED, prev);
  const values = formValues(formData);
  const purchase = replacementPurchaseSchema.safeParse(values);
  const credential = credentialSchema.safeParse(values);
  if (!purchase.success || !credential.success) {
    return failed("Not replaced. Check the fields marked below.", prev, {
      ...(purchase.success ? {} : refusal(purchase.error, prev).fieldErrors),
      ...(credential.success ? {} : refusal(credential.error, prev).fieldErrors),
    });
  }
  const orderId = await ticketOrderId(ticket.data);
  if (!orderId) return failed("Not saved: this ticket no longer exists.", prev);

  let sealed: string;
  try {
    sealed = encryptCredential(orderId, serializeCredential(credential.data));
  } catch {
    return failed("Not replaced: the vault key isn't set up on the server.", prev);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("replace_by_purchase", {
    p_ticket_id: ticket.data,
    p_supplier_order_number: purchase.data.supplierOrderNumber,
    p_cost: purchase.data.cost,
    p_kind: credential.data.kind,
    p_credential: sealed,
  });
  if (error?.code === "23505") {
    return failed("Not replaced. This numastore order number is already recorded.", prev, {
      supplierOrderNumber: ["Already recorded on an order"],
    });
  }
  if (error?.code === "42501" || error?.code === "P0002" || error?.code === "KJ006") {
    return ticketFailure(error, prev);
  }
  if (error) return failed(NOT_REPLACED, prev);

  refresh();
  return saved("Replaced. The new credential is in the customer's vault.", prev);
}

export async function refundTicket(ticketId: string, prev: FormState, formData: FormData): Promise<FormState> {
  const ticket = idSchema.safeParse(ticketId);
  if (!ticket.success) return failed(MALFORMED, prev);
  const refund = refundSchema.safeParse(formValues(formData));
  if (!refund.success) return refusal(refund.error, prev);

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("refund_ticket", {
    p_ticket_id: ticket.data,
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
  if (error) return ticketFailure(error, prev);

  refresh();
  return saved("Refund recorded.", prev);
}

// The database records the reveal, then hands over the ciphertext and the id
// it was sealed against: the order's, or the stock item's it came from.
export async function revealReplacedCredential(id: number): Promise<RevealResult> {
  if (!Number.isSafeInteger(id) || id < 1) return { ok: false, message: "This credential doesn't exist." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("reveal_replaced_credential", { p_replaced_credential_id: id }).single();
  if (error?.code === "42501") return { ok: false, message: "This account isn't an admin." };
  if (error || !data) return { ok: false, message: "This credential couldn't be found." };

  try {
    const plain = decryptCredential(data.sealed_to, data.credential);
    return { ok: true, credential: parseCredential(plain, data.kind) };
  } catch {
    return { ok: false, message: "This credential couldn't be opened." };
  }
}
