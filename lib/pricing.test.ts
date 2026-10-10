import assert from "node:assert/strict";
import { test } from "node:test";
import {
  daysSince,
  isPriceCheckStale,
  isThinMargin,
  marginPercent,
  sellPrice,
} from "./pricing.ts";

test("sell price is the supplier price plus the margin", () => {
  assert.equal(sellPrice(400, 175), 575);
  assert.equal(sellPrice(2000, 175), 2175);
  assert.equal(sellPrice(900, 0), 900);
});

test("fractional or negative rupees are refused", () => {
  assert.throws(() => sellPrice(400.5, 175));
  assert.throws(() => sellPrice(400, -1));
});

test("margin percentage is of the sell price, rounded down", () => {
  // 175 / 575 = 30.4%
  assert.equal(marginPercent(400, 175), 30);
  // 175 / 2175 = 8.05%
  assert.equal(marginPercent(2000, 175), 8);
  // 99 / 1000 = 9.9%: shown as 9, not rounded up to look like 10
  assert.equal(marginPercent(901, 99), 9);
  assert.equal(marginPercent(500, 0), 0);
});

test("a margin under 10% of the sell price is thin", () => {
  assert.equal(isThinMargin(400, 175), false);
  assert.equal(isThinMargin(2000, 175), true);
  // exactly 10% is not under it
  assert.equal(isThinMargin(900, 100), false);
  assert.equal(isThinMargin(901, 100), true);
});

test("days since counts whole days only", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  assert.equal(daysSince(new Date("2026-10-10T00:00:00Z"), now), 0);
  assert.equal(daysSince(new Date("2026-09-30T12:00:00Z"), now), 10);
  // a clock a little ahead never gives a negative age
  assert.equal(daysSince(new Date("2026-10-10T12:01:00Z"), now), 0);
});

test("a price check goes stale after a week", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  assert.equal(isPriceCheckStale(new Date("2026-10-10T11:00:00Z"), now), false);
  assert.equal(isPriceCheckStale(new Date("2026-10-03T12:00:00Z"), now), false);
  assert.equal(isPriceCheckStale(new Date("2026-10-03T11:59:00Z"), now), true);
  assert.equal(isPriceCheckStale(new Date("2026-09-30T12:00:00Z"), now), true);
});
