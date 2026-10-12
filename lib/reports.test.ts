import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type ProductReport,
  formatWait,
  marginGaps,
  periodRange,
  profitPercent,
  reportTotals,
  toCsv,
} from "./reports.ts";

function product(overrides: Partial<ProductReport>): ProductReport {
  return {
    product_id: "p",
    product_name: "Product",
    delivered: 0,
    revenue: 0,
    supplier_cost: 0,
    planned_margin: 0,
    warranty_refunds: 0,
    warranty_refund_amount: 0,
    claim_replacements: 0,
    paid_replacements: 0,
    paid_replacement_cost: 0,
    out_of_stock_refunds: 0,
    out_of_stock_refund_amount: 0,
    rejected_refunds: 0,
    rejected_refund_amount: 0,
    ...overrides,
  };
}

test("this week runs Monday to Monday, midnight in Pakistan", () => {
  // Monday 12 Oct 2026, 03:00 in Pakistan is Sunday 22:00 UTC.
  const range = periodRange("this-week", new Date("2026-10-11T22:00:00Z"));
  assert.equal(range.from?.toISOString(), "2026-10-11T19:00:00.000Z");
  assert.equal(range.to?.toISOString(), "2026-10-18T19:00:00.000Z");

  // Sunday 18 Oct, 23:59 in Pakistan is still the same week.
  const sunday = periodRange("this-week", new Date("2026-10-18T18:59:00Z"));
  assert.equal(sunday.from?.toISOString(), "2026-10-11T19:00:00.000Z");
});

test("months start at midnight on the 1st in Pakistan", () => {
  // 1 Nov 2026, 02:00 in Pakistan, still 31 Oct in UTC.
  const now = new Date("2026-10-31T21:00:00Z");
  const thisMonth = periodRange("this-month", now);
  assert.equal(thisMonth.from?.toISOString(), "2026-10-31T19:00:00.000Z");
  assert.equal(thisMonth.to?.toISOString(), "2026-11-30T19:00:00.000Z");
  const lastMonth = periodRange("last-month", now);
  assert.equal(lastMonth.from?.toISOString(), "2026-09-30T19:00:00.000Z");
  assert.equal(lastMonth.to?.toISOString(), "2026-10-31T19:00:00.000Z");
});

test("last month in January is December of the year before", () => {
  const range = periodRange("last-month", new Date("2027-01-15T12:00:00Z"));
  assert.equal(range.from?.toISOString(), "2026-11-30T19:00:00.000Z");
  assert.equal(range.to?.toISOString(), "2026-12-31T19:00:00.000Z");
});

test("all time has no bounds", () => {
  assert.deepEqual(periodRange("all-time", new Date()), { from: null, to: null });
});

test("totals add up to the rupee across products", () => {
  const totals = reportTotals([
    product({ delivered: 2, revenue: 2400, supplier_cost: 1800 }),
    product({ delivered: 1, revenue: 1050, supplier_cost: 900 }),
  ]);
  assert.equal(totals.delivered, 3);
  assert.equal(totals.revenue, 3450);
  assert.equal(totals.supplierCost, 2700);
  assert.equal(totals.profit, 750);
  assert.equal(totals.profitAfterEverything, 750);
});

test("profit after everything takes off delivered-order refunds and paid replacements only", () => {
  const totals = reportTotals([
    product({
      delivered: 3,
      revenue: 3600,
      supplier_cost: 2700,
      warranty_refunds: 1,
      warranty_refund_amount: 400,
      paid_replacements: 1,
      paid_replacement_cost: 900,
      claim_replacements: 2,
      out_of_stock_refunds: 1,
      out_of_stock_refund_amount: 1200,
      rejected_refunds: 1,
      rejected_refund_amount: 1200,
    }),
  ]);
  assert.equal(totals.profit, 900);
  assert.equal(totals.profitAfterEverything, 900 - 400 - 900);
  assert.equal(totals.warrantyRefunds, 1);
  assert.equal(totals.claimReplacements, 2);
});

test("profit percent rounds towards zero and has none without revenue", () => {
  // 299 / 1200 = 24.9%
  assert.equal(profitPercent(299, 1200), 24);
  // -1300 / 3600 = -36.1%: shown as -36, never rounded to look better
  assert.equal(profitPercent(-1300, 3600), -36);
  assert.equal(profitPercent(0, 0), null);
});

test("a purchase Rs 100 over the plan shows a real margin Rs 100 under planned, first", () => {
  const gaps = marginGaps([
    product({ product_id: "a", product_name: "Alpha", delivered: 1, revenue: 1200, supplier_cost: 900, planned_margin: 300 }),
    product({ product_id: "b", product_name: "Beta", delivered: 1, revenue: 1200, supplier_cost: 1000, planned_margin: 300 }),
    product({ product_id: "c", product_name: "Gamma", out_of_stock_refunds: 1 }),
  ]);
  assert.deepEqual(
    gaps.map((g) => [g.productName, g.planned, g.real, g.gap]),
    [
      ["Beta", 300, 200, -100],
      ["Alpha", 300, 300, 0],
    ],
  );
});

test("waits are shown to the nearest minute", () => {
  assert.equal(formatWait(20), "under 1 min");
  assert.equal(formatWait(240), "4 min");
  assert.equal(formatWait(3900), "1 h 05 min");
  assert.equal(formatWait(26 * 3600 + 1800), "1 d 2 h");
  assert.throws(() => formatWait(-1));
});

test("csv quotes what needs quoting and defuses formulas", () => {
  const csv = toCsv(["Product", "Price"], [
    ["Plain", 1200],
    ['Say "hi", then', 900],
    ["=HYPERLINK(1)", 100],
    ["-cmd", 5],
  ]);
  assert.equal(
    csv,
    'Product,Price\r\nPlain,1200\r\n"Say ""hi"", then",900\r\n\'=HYPERLINK(1),100\r\n\'-cmd,5\r\n',
  );
});
