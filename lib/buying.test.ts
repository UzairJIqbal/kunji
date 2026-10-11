import assert from "node:assert/strict";
import { test } from "node:test";
import { boughtSchema, buyNeededPing, formatWaiting, isOverdue, minutesWaiting, priceDifference } from "./buying.ts";

test("a purchase needs the numastore order number and a whole amount", () => {
  assert.deepEqual(boughtSchema.parse({ supplierOrderNumber: " NS-123 ", amountPaid: "1250" }), {
    supplierOrderNumber: "NS-123",
    amountPaid: 1250,
  });
  assert.equal(boughtSchema.safeParse({ supplierOrderNumber: "", amountPaid: "1250" }).success, false);
  assert.equal(boughtSchema.safeParse({ supplierOrderNumber: "  ", amountPaid: "1250" }).success, false);
  assert.equal(boughtSchema.safeParse({ amountPaid: "1250" }).success, false);
  assert.equal(boughtSchema.safeParse({ supplierOrderNumber: "NS-1", amountPaid: "0" }).success, false);
  assert.equal(boughtSchema.safeParse({ supplierOrderNumber: "NS-1", amountPaid: "12.5" }).success, false);
  assert.equal(boughtSchema.safeParse({ supplierOrderNumber: "NS-1", amountPaid: "-5" }).success, false);
  assert.equal(boughtSchema.safeParse({ supplierOrderNumber: "x".repeat(65), amountPaid: "5" }).success, false);
});

test("the difference from the listed price is said both ways, and not at all when it matches", () => {
  assert.equal(priceDifference(1250, 1200), "Rs 50 more than the plan lists (Rs 1,200)");
  assert.equal(priceDifference(1150, 1200), "Rs 50 less than the plan lists (Rs 1,200)");
  assert.equal(priceDifference(1200, 1200), null);
});

test("waiting is whole minutes since approval, never negative", () => {
  const paid = "2026-10-11T10:00:00Z";
  assert.equal(minutesWaiting(paid, new Date("2026-10-11T10:00:59Z")), 0);
  assert.equal(minutesWaiting(paid, new Date("2026-10-11T10:31:00Z")), 31);
  assert.equal(minutesWaiting(paid, new Date("2026-10-11T09:59:00Z")), 0);
  assert.throws(() => minutesWaiting("not a time", new Date()));
});

test("an order is overdue only after more than 30 minutes", () => {
  assert.equal(isOverdue(30), false);
  assert.equal(isOverdue(31), true);
});

test("waiting reads in minutes, then hours", () => {
  assert.equal(formatWaiting(0), "0 min");
  assert.equal(formatWaiting(59), "59 min");
  assert.equal(formatWaiting(60), "1 h");
  assert.equal(formatWaiting(125), "2 h 5 min");
});

test("the buy ping carries the order number, amount and the admin link only", () => {
  assert.deepEqual(buyNeededPing({ number: 1042, price: 1450 }, "https://kunji.example"), {
    title: "Buy needed: order #1042",
    message: "Rs 1,450 approved. Buy it on numastore.",
    click: "https://kunji.example/admin",
  });
});
