"use server";

import { refresh } from "next/cache";
import {
  type FormState,
  flagSchema,
  formValues,
  idSchema,
  paymentAccountSchema,
  refusal,
} from "@/lib/catalogue";
import { createServerSupabase } from "@/lib/supabase/server";

// As with the catalogue, the payment_accounts policies decide who may write.
// Accounts are switched off, never deleted: past payments name the method
// customers used, and a switched-off account can be switched back on.

const NOT_ALLOWED =
  "Not saved: this account isn't an admin, or the payment account no longer exists.";

function failed(message: string, prev: FormState): FormState {
  return { ok: false, message, fieldErrors: {}, version: prev.version };
}

function saved(message: string, prev: FormState): FormState {
  return { ok: true, message, fieldErrors: {}, version: prev.version + 1 };
}

function dbFailure(error: { code?: string; message: string }, prev: FormState): FormState {
  if (error.code === "42501") return failed(NOT_ALLOWED, prev);
  return failed(`Not saved: ${error.message}`, prev);
}

export async function createPaymentAccount(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = paymentAccountSchema.safeParse(formValues(formData));
  if (!parsed.success) return refusal(parsed.error, prev);
  const account = parsed.data;

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("payment_accounts").insert({
    method: account.method,
    account_title: account.accountTitle,
    account_number: account.accountNumber,
    bank_name: account.bankName,
  });
  if (error) return dbFailure(error, prev);

  refresh();
  return saved("Account added.", prev);
}

export async function updatePaymentAccount(
  accountId: string,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = idSchema.safeParse(accountId);
  if (!id.success) return failed("Not saved: the request was malformed. Reload and try again.", prev);
  const parsed = paymentAccountSchema.safeParse(formValues(formData));
  if (!parsed.success) return refusal(parsed.error, prev);
  const account = parsed.data;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("payment_accounts")
    .update({
      method: account.method,
      account_title: account.accountTitle,
      account_number: account.accountNumber,
      bank_name: account.bankName,
    })
    .eq("id", id.data)
    .select("id");
  if (error) return dbFailure(error, prev);
  if (data.length === 0) return failed(NOT_ALLOWED, prev);

  refresh();
  return saved("Saved.", prev);
}

export async function setPaymentAccountActive(
  accountId: string,
  active: boolean,
  prev: FormState,
): Promise<FormState> {
  const id = idSchema.safeParse(accountId);
  const flag = flagSchema.safeParse(active);
  if (!id.success || !flag.success) {
    return failed("Not saved: the request was malformed. Reload and try again.", prev);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("payment_accounts")
    .update({ active: flag.data })
    .eq("id", id.data)
    .select("id");
  if (error) return dbFailure(error, prev);
  if (data.length === 0) return failed(NOT_ALLOWED, prev);

  refresh();
  return saved("Saved.", prev);
}
