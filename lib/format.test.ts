import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatDays,
  formatDaysAgo,
  formatPakistanDate,
  formatPakistanTime,
  formatRupees,
  formatWarranty,
} from "./format.ts";

test("rupees are shown as Rs with thousands separators", () => {
  assert.equal(formatRupees(1200), "Rs 1,200");
  assert.equal(formatRupees(700), "Rs 700");
  assert.equal(formatRupees(125000), "Rs 125,000");
  assert.equal(formatRupees(0), "Rs 0");
});

test("a fractional rupee amount is refused, not rounded", () => {
  assert.throws(() => formatRupees(1200.5));
});

test("times are shown in Pakistan time (UTC+5) whatever the input zone", () => {
  // 19:30 UTC is 00:30 the next day in Karachi.
  assert.equal(formatPakistanTime("2026-10-09T19:30:00Z"), "10 Oct 2026, 12:30 am");
  assert.equal(formatPakistanTime(new Date("2026-10-10T07:03:00Z")), "10 Oct 2026, 12:03 pm");
});

test("a time that isn't one is refused", () => {
  assert.throws(() => formatPakistanTime("not a date"));
});

test("durations read naturally", () => {
  assert.equal(formatDays(1), "1 day");
  assert.equal(formatDays(30), "30 days");
});

test("a zero-day warranty reads as no warranty", () => {
  assert.equal(formatWarranty(0), "No warranty");
  assert.equal(formatWarranty(1), "1 day warranty");
  assert.equal(formatWarranty(30), "30 days warranty");
});

test("dates are the Pakistan calendar day", () => {
  // 20:00 UTC on the 30th is already 1 October in Karachi.
  assert.equal(formatPakistanDate("2026-09-30T20:00:00Z"), "1 Oct 2026");
  assert.throws(() => formatPakistanDate("nope"));
});

test("an age in days reads naturally", () => {
  assert.equal(formatDaysAgo(0), "today");
  assert.equal(formatDaysAgo(1), "1 day ago");
  assert.equal(formatDaysAgo(10), "10 days ago");
});
