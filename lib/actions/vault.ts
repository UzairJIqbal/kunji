"use server";

import { refresh } from "next/cache";
import { MALFORMED, decisionFailure, failed, saved } from "@/lib/actions/results";
import { type FormState, formValues, idSchema, refusal } from "@/lib/catalogue";
import { createServerSupabase } from "@/lib/supabase/server";
import { type Credential, credentialSchema, parseCredential, serializeCredential } from "@/lib/vault";
import { decryptCredential, encryptCredential } from "@/lib/vault-crypto";

// A credential passes through here in plain text and nowhere else on the
// server: encrypted before the database sees it, decrypted only on a reveal
// the database has just recorded. Nothing here logs, and no failure message
// carries a database error's own text, which can quote the row it refused.

const NOT_DELIVERED = "Not delivered. Nothing was saved; try again.";

export async function deliverOrder(orderId: string, prev: FormState, formData: FormData): Promise<FormState> {
  const order = idSchema.safeParse(orderId);
  if (!order.success) return failed(MALFORMED, prev);
  const credential = credentialSchema.safeParse(formValues(formData));
  if (!credential.success) return refusal(credential.error, prev);

  let sealed: string;
  try {
    sealed = encryptCredential(order.data, serializeCredential(credential.data));
  } catch {
    return failed("Not delivered: the vault key isn't set up on the server.", prev);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("deliver_order", {
    p_order_id: order.data,
    p_kind: credential.data.kind,
    p_credential: sealed,
  });
  if (error?.code === "42501" || error?.code === "P0002" || error?.code === "KJ006") {
    return decisionFailure(error, prev);
  }
  if (error) return failed(NOT_DELIVERED, prev);

  refresh();
  return saved("Delivered to the customer's vault.", prev);
}

export type RevealResult = { ok: true; credential: Credential } | { ok: false; message: string };

// The database records the reveal, then hands over the ciphertext; it opens
// here, for the entry's own customer or an admin, and goes straight back to
// the screen that asked.
export async function revealCredential(orderId: string): Promise<RevealResult> {
  const order = idSchema.safeParse(orderId);
  if (!order.success) return { ok: false, message: "This vault entry doesn't exist." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("reveal_credential", { p_order_id: order.data }).single();
  if (error?.code === "42501") return { ok: false, message: "Sign in again to see this." };
  if (error || !data) return { ok: false, message: "This vault entry couldn't be found." };

  try {
    const plain = decryptCredential(order.data, data.credential);
    return { ok: true, credential: parseCredential(plain, data.kind) };
  } catch {
    return { ok: false, message: "This vault entry couldn't be opened. Message us on WhatsApp." };
  }
}
