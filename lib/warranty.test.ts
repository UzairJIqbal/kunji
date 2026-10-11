import assert from "node:assert/strict";
import { test } from "node:test";
import { vaultDates } from "./vault.ts";
import {
  claimSchema,
  proRataRefund,
  replacementPurchaseSchema,
  ticketIsOpen,
  ticketOpenedPing,
  ticketSchema,
  warrantyRunning,
} from "./warranty.ts";

test("the refund suggestion is the unused share of the price", () => {
  assert.equal(proRataRefund(600, 15, 30), 300);
  assert.equal(proRataRefund(600, 30, 30), 600);
  assert.equal(proRataRefund(600, 0, 30), 0);
});

test("the refund suggestion rounds to the nearest rupee", () => {
  assert.equal(proRataRefund(1000, 1, 3), 333);
  assert.equal(proRataRefund(1000, 2, 3), 667);
});

test("the refund suggestion never passes the price", () => {
  assert.equal(proRataRefund(600, 45, 30), 600);
});

test("the refund suggestion refuses what isn't whole rupees or days", () => {
  assert.throws(() => proRataRefund(600.5, 15, 30));
  assert.throws(() => proRataRefund(600, -1, 30));
  assert.equal(proRataRefund(600, 0, 0), 0);
});

test("warranty runs until the instant it ends, from the first delivery", () => {
  const { warrantyEndsAt } = vaultDates("2026-10-01T10:00:00Z", 30, 7);
  assert.equal(warrantyRunning(warrantyEndsAt, new Date("2026-10-08T09:59:59Z")), true);
  assert.equal(warrantyRunning(warrantyEndsAt, new Date("2026-10-08T10:00:00Z")), false);
});

test("open and claimed tickets are open; replaced and refunded are closed", () => {
  assert.equal(ticketIsOpen("open"), true);
  assert.equal(ticketIsOpen("claimed"), true);
  assert.equal(ticketIsOpen("replaced"), false);
  assert.equal(ticketIsOpen("refunded"), false);
});

test("a ticket needs a reason, and a note when the reason is something else", () => {
  assert.equal(ticketSchema.safeParse({ reason: "login_failed" }).success, true);
  assert.equal(ticketSchema.safeParse({ reason: "other", note: "  " }).success, false);
  assert.equal(ticketSchema.safeParse({ reason: "other", note: "Asks for a code" }).success, true);
  assert.equal(ticketSchema.safeParse({ reason: "broken" }).success, false);
  assert.equal(ticketSchema.safeParse({ reason: "ended_early", note: "x".repeat(2001) }).success, false);
});

test("a claim needs its reference; a bought replacement needs a number and a whole cost", () => {
  assert.equal(claimSchema.safeParse({ reference: " " }).success, false);
  assert.equal(claimSchema.safeParse({ reference: "T-123" }).success, true);
  assert.deepEqual(replacementPurchaseSchema.parse({ supplierOrderNumber: "NS 1", cost: "900" }), {
    supplierOrderNumber: "NS 1",
    cost: 900,
  });
  assert.equal(replacementPurchaseSchema.safeParse({ supplierOrderNumber: "NS 1", cost: "0" }).success, false);
  assert.equal(replacementPurchaseSchema.safeParse({ supplierOrderNumber: "NS 1", cost: "9.5" }).success, false);
});

test("the ticket ping names the order and reason, and links to the ticket", () => {
  assert.deepEqual(
    ticketOpenedPing({ id: "abc", orderNumber: 1042, reason: "login_failed" }, "https://kunji.example"),
    {
      title: "Problem reported: order #1042",
      message: "Login doesn't work",
      click: "https://kunji.example/admin/tickets/abc",
    },
  );
});
