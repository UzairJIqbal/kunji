// The seller's reports: which dates a period covers, and the sums over what
// the database returned. Every figure is arithmetic over recorded rows; there
// is nothing here that guesses.

import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";

export const REPORT_PERIODS = ["this-week", "this-month", "last-month", "all-time"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const reportPeriodLabel: Record<ReportPeriod, string> = {
  "this-week": "This week",
  "this-month": "This month",
  "last-month": "Last month",
  "all-time": "All time",
};

export const DEFAULT_REPORT_PERIOD: ReportPeriod = "this-month";

// The period is the only thing a report takes from the address. Missing means
// the default; anything else that isn't one of the four is refused.
export const reportPeriodSchema = z.enum(REPORT_PERIODS).default(DEFAULT_REPORT_PERIOD);

// Pakistan has kept UTC+5 all year since 2009, so a fixed offset is exact.
const PAKISTAN_OFFSET_MS = 5 * 60 * 60 * 1000;

// From inclusive, to exclusive; null means no bound. Weeks start on Monday,
// and every boundary is midnight in Pakistan, not on the server.
export type PeriodRange = { from: Date | null; to: Date | null };

function pakistanMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - PAKISTAN_OFFSET_MS);
}

export function periodRange(period: ReportPeriod, now: Date): PeriodRange {
  // The wall clock in Pakistan, read through the UTC getters.
  const local = new Date(now.getTime() + PAKISTAN_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();

  switch (period) {
    case "this-week": {
      const sinceMonday = (local.getUTCDay() + 6) % 7;
      return {
        from: pakistanMidnight(year, month, day - sinceMonday),
        to: pakistanMidnight(year, month, day - sinceMonday + 7),
      };
    }
    case "this-month":
      return { from: pakistanMidnight(year, month, 1), to: pakistanMidnight(year, month + 1, 1) };
    case "last-month":
      return { from: pakistanMidnight(year, month - 1, 1), to: pakistanMidnight(year, month, 1) };
    case "all-time":
      return { from: null, to: null };
  }
}

export type ProductReport = Database["public"]["Functions"]["report_products"]["Returns"][number];
export type WaitingTime = Database["public"]["Functions"]["report_waiting_times"]["Returns"][number];
export type OrderReport = Database["public"]["Functions"]["report_orders"]["Returns"][number];

// Sales profit is what customers paid for delivered orders less what was
// actually paid to numastore for them. After everything, refunds of
// delivered orders and replacements the seller paid for come off too, each in
// the period it happened. Out-of-stock and rejected-payment refunds give back
// money that was never counted as revenue, so they don't.
export type ReportTotals = {
  delivered: number;
  revenue: number;
  supplierCost: number;
  profit: number;
  warrantyRefunds: number;
  warrantyRefundAmount: number;
  paidReplacements: number;
  paidReplacementCost: number;
  claimReplacements: number;
  outOfStockRefunds: number;
  outOfStockRefundAmount: number;
  rejectedRefunds: number;
  rejectedRefundAmount: number;
  profitAfterEverything: number;
};

export function reportTotals(rows: readonly ProductReport[]): ReportTotals {
  const sum = (pick: (row: ProductReport) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const revenue = sum((r) => r.revenue);
  const supplierCost = sum((r) => r.supplier_cost);
  const warrantyRefundAmount = sum((r) => r.warranty_refund_amount);
  const paidReplacementCost = sum((r) => r.paid_replacement_cost);
  return {
    delivered: sum((r) => r.delivered),
    revenue,
    supplierCost,
    profit: revenue - supplierCost,
    warrantyRefunds: sum((r) => r.warranty_refunds),
    warrantyRefundAmount,
    paidReplacements: sum((r) => r.paid_replacements),
    paidReplacementCost,
    claimReplacements: sum((r) => r.claim_replacements),
    outOfStockRefunds: sum((r) => r.out_of_stock_refunds),
    outOfStockRefundAmount: sum((r) => r.out_of_stock_refund_amount),
    rejectedRefunds: sum((r) => r.rejected_refunds),
    rejectedRefundAmount: sum((r) => r.rejected_refund_amount),
    profitAfterEverything: revenue - supplierCost - warrantyRefundAmount - paidReplacementCost,
  };
}

// Profit as a share of revenue, rounded towards zero so it never reads better
// than it is. No revenue, no percentage: zero would be a made-up number.
export function profitPercent(profit: number, revenue: number): number | null {
  if (revenue === 0) return null;
  return Math.trunc((profit * 100) / revenue);
}

export type MarginGap = {
  productId: string;
  productName: string;
  delivered: number;
  planned: number;
  real: number;
  gap: number;
};

// Planned is the margin each order was placed with; real is what it made
// against what numastore actually charged. A negative gap means numastore
// charged more than the plan says, so those come first, worst at the top.
export function marginGaps(rows: readonly ProductReport[]): MarginGap[] {
  return rows
    .filter((row) => row.delivered > 0)
    .map((row) => {
      const real = row.revenue - row.supplier_cost;
      return {
        productId: row.product_id,
        productName: row.product_name,
        delivered: row.delivered,
        planned: row.planned_margin,
        real,
        gap: real - row.planned_margin,
      };
    })
    .sort((a, b) => a.gap - b.gap || a.productName.localeCompare(b.productName));
}

// Waits are shown to the minute, rounded to the nearest: they're for spotting
// a slow step, and seconds would only be noise.
export function formatWait(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`Not a wait: ${seconds}`);
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "under 1 min";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
  }
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  return `${days} d ${hours} h`;
}

// A cell a spreadsheet would read as a formula is prefixed with an apostrophe,
// so a product name the seller typed can never run as one when opened.
function csvCell(value: string | number): string {
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(header: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
