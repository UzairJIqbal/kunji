import { z } from "zod";
// Relative, with their extensions, so the tests can load this file directly.
import { requiredText, wholeNumber } from "./catalogue.ts";
import { formatRupees } from "./format.ts";

// What the seller types after buying on numastore, checked on the server. The
// order, its state and the plan's listed price come from the database.

export const boughtSchema = z.object({
  supplierOrderNumber: requiredText("numastore order number", 64),
  amountPaid: wholeNumber("Amount paid", 1, 1_000_000),
});
export type BoughtInput = z.infer<typeof boughtSchema>;

// What the seller paid against what the plan lists, said the way they'd say
// it. Null when they match: nothing to decide.
export function priceDifference(amountPaid: number, listed: number): string | null {
  const difference = amountPaid - listed;
  if (difference === 0) return null;
  return difference > 0
    ? `${formatRupees(difference)} more than the plan lists (${formatRupees(listed)})`
    : `${formatRupees(-difference)} less than the plan lists (${formatRupees(listed)})`;
}

// ───────────────────────────── Waiting ─────────────────────────────

// A paid order waiting longer than this is the one the seller has forgotten.
export const OVERDUE_MINUTES = 30;

// Whole minutes since the payment was approved, from the order's paid event.
// Never negative: a clock a little behind the database's says 0, not -1.
export function minutesWaiting(paidAt: string | Date, now: Date): number {
  const since = typeof paidAt === "string" ? new Date(paidAt) : paidAt;
  if (Number.isNaN(since.getTime())) throw new Error(`Not a time: ${String(paidAt)}`);
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / 60_000));
}

export function isOverdue(minutes: number): boolean {
  return minutes > OVERDUE_MINUTES;
}

export function formatWaiting(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
