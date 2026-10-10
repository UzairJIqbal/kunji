import { z } from "zod";
// Relative, with their extensions, so the tests can load this file directly.
import { type PaymentMethod, paymentMethodLabel, paymentMethods, requiredText, wholeNumber } from "./catalogue.ts";
import { formatClockTime, formatRupees } from "./format.ts";

// What the seller types when deciding on a payment, checked on the server. The
// order and its price come from the database; the browser only names the order.

// ───────────────────────────── Rejecting ─────────────────────────────

// The customer reads the reason, so these are worded for them.
export const rejectReasons = ["Amount wrong", "Transaction not found", "Receipt unreadable"] as const;

export const OTHER_REASON = "other";

export const rejectionSchema = z
  .object({
    reason: z.enum([...rejectReasons, OTHER_REASON], { error: "Choose a reason" }),
    otherReason: z.string({ error: "The reason must be text" }).trim().max(200, "The reason is at most 200 characters").default(""),
  })
  .superRefine((value, ctx) => {
    if (value.reason === OTHER_REASON && value.otherReason === "") {
      ctx.addIssue({ code: "custom", path: ["otherReason"], message: "Type the reason" });
    }
  })
  .transform((value) => ({ reason: value.reason === OTHER_REASON ? value.otherReason : value.reason }));

// ───────────────────────────── Refunding ─────────────────────────────

// The amount is checked against the order's price by the database, which knows
// the price; this only makes sure it's a whole number of rupees.
export const refundSchema = z.object({
  amount: wholeNumber("Amount", 1, 1_000_000),
  method: z.enum(paymentMethods, { error: "Method is required" }),
  reference: requiredText("Reference", 64),
});
export type RefundInput = z.infer<typeof refundSchema>;

// ───────────────────────────── Away ─────────────────────────────

// As a time input sends it: 24-hour, Pakistan time.
export const awaySchema = z.object({
  backAt: z
    .string({ error: "Back-at time is required" })
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Back-at time is required"),
});

export function awayMessage(backAt: string): string {
  return `Orders placed now are delivered after ${formatClockTime(backAt)}`;
}

// ───────────────────────────── The ping ─────────────────────────────

// A notification in a third party's app: the order number, what to look for in
// the wallet, and where to check it. Nothing about the customer, no receipt.
// Tapping it opens the queue.
export function newProofPing(
  order: { number: number; price: number; method: PaymentMethod },
  siteUrl: string,
): { title: string; message: string; click: string } {
  return {
    title: `Payment to check: order #${order.number}`,
    message: `${formatRupees(order.price)} by ${paymentMethodLabel[order.method]}`,
    click: new URL("/admin", siteUrl).toString(),
  };
}

// ───────────────────────────── Showing ─────────────────────────────

// The account the customer says they paid into, as the seller would look for
// it in their wallet app.
export function paidIntoLabel(account: {
  account_title: string;
  account_number: string;
  bank_name: string | null;
}): string {
  return [account.account_title, account.account_number, account.bank_name].filter(Boolean).join(", ");
}
