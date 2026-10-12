import assert from "node:assert/strict";
import { test } from "node:test";
import { formatClockTime } from "./format.ts";
import { awayMessage, awaySchema, newProofAlert, paidIntoLabel, refundSchema, rejectionSchema } from "./verification.ts";

test("a back-at time reads the way people say it", () => {
  assert.equal(formatClockTime("10:00:00"), "10am");
  assert.equal(formatClockTime("10:30:00"), "10:30am");
  assert.equal(formatClockTime("00:00"), "12am");
  assert.equal(formatClockTime("12:00"), "12pm");
  assert.equal(formatClockTime("23:45"), "11:45pm");
});

test("something that isn't a time of day is refused", () => {
  assert.throws(() => formatClockTime("24:00"));
  assert.throws(() => formatClockTime("10am"));
  assert.throws(() => formatClockTime(""));
});

test("the away banner uses the time that was set", () => {
  assert.equal(awayMessage("10:00:00"), "Orders placed now are delivered after 10am");
});

test("the back-at time is a 24-hour time from a time input", () => {
  assert.equal(awaySchema.safeParse({ backAt: "10:00" }).success, true);
  assert.equal(awaySchema.safeParse({ backAt: "" }).success, false);
  assert.equal(awaySchema.safeParse({ backAt: "25:00" }).success, false);
  assert.equal(awaySchema.safeParse({}).success, false);
});

test("a listed reason is used as it is", () => {
  assert.deepEqual(rejectionSchema.parse({ reason: "Amount wrong" }), { reason: "Amount wrong" });
});

test("a typed reason is used when other is picked, and must be there", () => {
  assert.deepEqual(rejectionSchema.parse({ reason: "other", otherReason: "  Sent to the wrong number " }), {
    reason: "Sent to the wrong number",
  });
  assert.equal(rejectionSchema.safeParse({ reason: "other", otherReason: " " }).success, false);
  assert.equal(rejectionSchema.safeParse({ reason: "other", otherReason: "x".repeat(201) }).success, false);
});

test("a reason that isn't on the list or other is refused", () => {
  assert.equal(rejectionSchema.safeParse({ reason: "anything" }).success, false);
  assert.equal(rejectionSchema.safeParse({}).success, false);
});

test("a refund amount is whole rupees, typed as digits", () => {
  const ok = refundSchema.parse({ amount: "1200", method: "easypaisa", reference: " TX1 " });
  assert.deepEqual(ok, { amount: 1200, method: "easypaisa", reference: "TX1" });
  for (const amount of ["0", "12.5", "-4", "1e3", ""]) {
    assert.equal(refundSchema.safeParse({ amount, method: "easypaisa", reference: "TX1" }).success, false, amount);
  }
  assert.equal(refundSchema.safeParse({ amount: "10", method: "cash", reference: "TX1" }).success, false);
  assert.equal(refundSchema.safeParse({ amount: "10", method: "easypaisa", reference: "" }).success, false);
});

test("the proof alert carries the order number, amount, method and queue link, nothing else", () => {
  assert.deepEqual(newProofAlert({ number: 1042, price: 1200, method: "jazzcash" }, "https://kunji.example"), {
    title: "Payment to check: order #1042",
    message: "Rs 1,200 by JazzCash",
    click: "https://kunji.example/admin",
  });
});

test("the account paid into names the bank only when there is one", () => {
  assert.equal(
    paidIntoLabel({ account_title: "Kunji", account_number: "03001234567", bank_name: null }),
    "Kunji, 03001234567",
  );
  assert.equal(
    paidIntoLabel({ account_title: "Kunji", account_number: "PK36MEZN0001", bank_name: "Meezan" }),
    "Kunji, PK36MEZN0001, Meezan",
  );
});
