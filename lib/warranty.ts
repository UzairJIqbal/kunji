import { z } from "zod";
// Relative, with their extensions, so the tests can load this file directly.
import { requiredText, wholeNumber } from "./catalogue.ts";
import type { StatusTone } from "./order-status.ts";
import { Constants, type Database } from "./supabase/database.types.ts";

export type TicketReason = Database["public"]["Enums"]["ticket_reason"];
export type TicketStatus = Database["public"]["Enums"]["ticket_status"];
export type ReplacementSource = Database["public"]["Enums"]["replacement_source"];

export const ticketReasons = Constants.public.Enums.ticket_reason;

export const ticketReasonLabel: Record<TicketReason, string> = {
  login_failed: "Login doesn't work",
  ended_early: "Subscription ended early",
  other: "Something else",
};

export const TICKET_SCREENSHOT_BUCKET = "ticket-screenshots";
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // the bucket's own limit

// ───────────────────────────── Where a ticket stands ─────────────────────────────

// Open and claimed are both waiting on the seller; the customer only learns
// that a claim means a replacement is coming, never where it was claimed.
export function ticketIsOpen(status: TicketStatus): boolean {
  return status === "open" || status === "claimed";
}

export const customerTicketStatus: Record<TicketStatus, { label: string; tone: StatusTone }> = {
  open: { label: "We're looking into it", tone: "warning" },
  claimed: { label: "We're getting you a replacement", tone: "warning" },
  replaced: { label: "Replaced", tone: "success" },
  refunded: { label: "Refunded", tone: "danger" },
};

export const adminTicketStatus: Record<TicketStatus, { label: string; tone: StatusTone }> = {
  open: { label: "Open", tone: "warning" },
  claimed: { label: "Claimed", tone: "warning" },
  replaced: { label: "Replaced", tone: "success" },
  refunded: { label: "Refunded", tone: "danger" },
};

// The same test the database applies to a new ticket: running until the
// instant it ends, not a moment after. Only decides what's shown; the
// database decides what's accepted.
export function warrantyRunning(warrantyEndsAt: Date, now: Date): boolean {
  return now.getTime() < warrantyEndsAt.getTime();
}

// ───────────────────────────── Money ─────────────────────────────

// The unused share of what the customer paid: price × days left ÷ days bought,
// to the nearest rupee. Days left can't exceed days bought, so the suggestion
// never passes the price. The seller may change it; the database caps it.
export function proRataRefund(price: number, daysLeft: number, daysBought: number): number {
  for (const value of [price, daysLeft, daysBought]) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`Not a whole number: ${value}`);
  }
  if (daysBought === 0) return 0;
  return Math.round((price * Math.min(daysLeft, daysBought)) / daysBought);
}

// ───────────────────────────── Forms ─────────────────────────────

// What the customer says is wrong. A note is optional unless they chose
// "something else", which says nothing on its own. The screenshot is checked
// beside this, from its bytes.
export const ticketSchema = z
  .object({
    reason: z.enum(ticketReasons, { error: "Choose what's wrong" }),
    note: z
      .string({ error: "The note must be text" })
      .trim()
      .max(2000, "The note is at most 2000 characters")
      .default(""),
  })
  .superRefine((value, ctx) => {
    if (value.reason === "other" && value.note === "") {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Tell us what's wrong" });
    }
  });
export type TicketInput = z.infer<typeof ticketSchema>;

export const messageSchema = z.object({
  body: requiredText("Message", 2000),
});

export const claimSchema = z.object({
  reference: requiredText("numastore ticket reference", 64),
});

// The credential itself is parsed beside this with the vault's own schema.
export const replacementPurchaseSchema = z.object({
  supplierOrderNumber: requiredText("numastore order number", 64),
  cost: wholeNumber("Cost", 1, 1_000_000),
});
