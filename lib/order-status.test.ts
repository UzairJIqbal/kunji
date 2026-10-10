import assert from "node:assert/strict";
import { test } from "node:test";
import { customerOrderStatus, isExpired } from "./order-status.ts";

const now = new Date("2026-10-10T12:00:00Z");
const before = "2026-10-10T11:59:59Z";
const after = "2026-10-10T12:00:01Z";

test("an unpaid order expires the moment its time passes", () => {
  assert.equal(isExpired({ status: "awaiting_payment", expires_at: after }, now), false);
  assert.equal(isExpired({ status: "awaiting_payment", expires_at: now.toISOString() }, now), true);
  assert.equal(isExpired({ status: "awaiting_payment", expires_at: before }, now), true);
});

test("an order with proof never expires, however late it is", () => {
  assert.equal(isExpired({ status: "verifying", expires_at: before }, now), false);
  assert.equal(isExpired({ status: "delivered", expires_at: before }, now), false);
});

test("a customer sees an expired order as expired, in no status colour", () => {
  assert.deepEqual(customerOrderStatus({ status: "awaiting_payment", expires_at: before }, now), {
    label: "Expired",
    tone: "plain",
  });
  assert.deepEqual(customerOrderStatus({ status: "verifying", expires_at: before }, now), {
    label: "Checking your payment",
    tone: "warning",
  });
});
