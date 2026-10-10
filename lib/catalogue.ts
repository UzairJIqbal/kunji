import { z } from "zod";
// Relative, with its extension, so the tests can load this file directly.
import { Constants, type Database } from "./supabase/database.types.ts";

export type AccountType = Database["public"]["Enums"]["account_type"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];

export const accountTypes = Constants.public.Enums.account_type;
export const paymentMethods = Constants.public.Enums.payment_method;

// Worded as the customer will read it: what they actually get.
export const accountTypeLabel: Record<AccountType, string> = {
  own_account: "Your own account",
  shared_slot: "A shared slot",
  email_invite: "An invite to your email",
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  easypaisa: "Easypaisa",
  jazzcash: "JazzCash",
  nayapay: "NayaPay",
  sadapay: "SadaPay",
  bank_transfer: "Bank transfer",
};

export const MAX_IMAGE_BYTES = 1024 * 1024; // the bucket's own limit

// ───────────────────────────── Form parsing ─────────────────────────────
//
// Forms arrive as FormData: every value is a string or a file, and a field the
// browser left out is missing altogether. Each message names its field, so a
// refusal says what to fix without the seller having to find a red outline.

export function requiredText(label: string, max: number) {
  return z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} is at most ${max} characters`);
}

function optionalText(label: string, max: number) {
  return z
    .string({ error: `${label} must be text` })
    .trim()
    .max(max, `${label} is at most ${max} characters`)
    .default("");
}

// Whole numbers only, typed as digits: "1e3", "12.5" and "-4" are refused
// rather than coerced into something the seller didn't type.
export function wholeNumber(label: string, min: number, max: number) {
  return z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .regex(/^\d+$/, `${label} must be a whole number`)
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(min, `${label} must be at least ${min}`)
        .max(max, `${label} is at most ${max}`),
    );
}

const uuid = z.uuid();

export const productSchema = z.object({
  name: requiredText("Name", 120),
  category: requiredText("Category", 60),
  description: optionalText("Short description", 600),
  setupInstructions: optionalText("Setup instructions", 4000),
  accountType: z.enum(accountTypes, { error: "Account type is required" }),
  // Blank means there's no note, stored as nothing rather than an empty string.
  planNote: optionalText("Region or plan note", 300).transform((note) => note || null),
  needsActivationEmail: z.boolean(),
});
export type ProductInput = z.infer<typeof productSchema>;

export const planSchema = z.object({
  durationDays: wholeNumber("Duration", 1, 3650),
  warrantyDays: wholeNumber("Warranty", 0, 3650),
  supplierPrice: wholeNumber("Numastore price", 1, 1_000_000),
  margin: wholeNumber("Margin", 0, 1_000_000),
  // Stored for the seller to open, never fetched. Held to numastore's own
  // host so a typo'd or lookalike link can't be saved by mistake.
  numastoreUrl: z
    .string({ error: "Numastore link is required" })
    .trim()
    .min(1, "Numastore link is required")
    .pipe(
      z.url({
        protocol: /^https$/,
        hostname: /^(www\.)?numastore\.pro$/,
        error: "Numastore link must be an https://numastore.pro link",
      }),
    ),
});
export type PlanInput = z.infer<typeof planSchema>;

export const paymentAccountSchema = z
  .object({
    method: z.enum(paymentMethods, { error: "Method is required" }),
    accountTitle: requiredText("Account title", 100),
    accountNumber: requiredText("Account number", 40),
    bankName: optionalText("Bank name", 80),
  })
  .superRefine((value, ctx) => {
    if (value.method === "bank_transfer" && value.bankName === "") {
      ctx.addIssue({
        code: "custom",
        path: ["bankName"],
        message: "Bank name is required for a bank transfer",
      });
    }
  })
  // The table insists a bank name goes with a bank transfer and nothing else.
  .transform((value) => ({
    ...value,
    bankName: value.method === "bank_transfer" ? value.bankName : null,
  }));
export type PaymentAccountInput = z.infer<typeof paymentAccountSchema>;

export const idSchema = uuid;
export const flagSchema = z.boolean();

// What a form shows after the server has answered. `version` goes up on each
// successful save, so a form can start afresh (an add-plan form clearing
// itself) without the server knowing anything about the page.
export type FormState = {
  ok: boolean;
  message: string | null;
  fieldErrors: Partial<Record<string, string[]>>;
  version: number;
};

export const emptyFormState: FormState = { ok: false, message: null, fieldErrors: {}, version: 0 };

export function refusal<T extends object>(
  error: z.ZodError<T>,
  prev: FormState = emptyFormState,
): FormState {
  const { fieldErrors, formErrors } = z.flattenError(error);
  const lists: (string[] | undefined)[] = Object.values(fieldErrors);
  const named = lists.flatMap((messages) => messages?.slice(0, 1) ?? []);
  return {
    ok: false,
    message: `Not saved. ${[...formErrors, ...named].join(". ")}.`,
    fieldErrors,
    version: prev.version,
  };
}

// FormData's own shape: a value per field name, files included.
export function formValues(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData);
}
