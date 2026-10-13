import assert from "node:assert/strict";
import { test } from "node:test";
import {
  credentialSchema,
  daysLeft,
  parseCredential,
  serializeCredential,
  vaultDates,
  vaultStanding,
} from "./vault.ts";

test("expiry and warranty end run from the delivery", () => {
  const { expiresAt, warrantyEndsAt } = vaultDates("2026-10-01T10:00:00Z", 30, 14);
  assert.equal(expiresAt.toISOString(), "2026-10-31T10:00:00.000Z");
  assert.equal(warrantyEndsAt.toISOString(), "2026-10-15T10:00:00.000Z");
});

test("a login from stock ends on its own date; its warranty still runs from delivery", () => {
  const { expiresAt, warrantyEndsAt } = vaultDates("2026-10-01T10:00:00Z", 365, 14, "2027-09-09T19:00:00Z");
  assert.equal(expiresAt.toISOString(), "2027-09-09T19:00:00.000Z");
  assert.equal(warrantyEndsAt.toISOString(), "2026-10-15T10:00:00.000Z");
  assert.throws(() => vaultDates("2026-10-01T10:00:00Z", 365, 14, "soon"));
});

test("no warranty ends the moment it's delivered", () => {
  const { warrantyEndsAt } = vaultDates("2026-10-01T10:00:00Z", 30, 0);
  assert.equal(warrantyEndsAt.toISOString(), "2026-10-01T10:00:00.000Z");
});

test("nonsense dates and days are refused", () => {
  assert.throws(() => vaultDates("yesterday", 30, 0));
  assert.throws(() => vaultDates("2026-10-01T10:00:00Z", 1.5, 0));
  assert.throws(() => vaultDates("2026-10-01T10:00:00Z", 30, -1));
});

test("expiring soon is the last 7 days, expired is from the moment it ends", () => {
  const ends = new Date("2026-10-31T10:00:00Z");
  assert.equal(vaultStanding(ends, new Date("2026-10-23T10:00:00Z"), "delivered"), "active");
  assert.equal(vaultStanding(ends, new Date("2026-10-24T10:00:00Z"), "delivered"), "expiring_soon");
  assert.equal(vaultStanding(ends, new Date("2026-10-31T09:59:59Z"), "delivered"), "expiring_soon");
  assert.equal(vaultStanding(ends, new Date("2026-10-31T10:00:00Z"), "delivered"), "expired");
  assert.equal(vaultStanding(ends, new Date("2026-12-01T00:00:00Z"), "delivered"), "expired");
});

test("a refunded order's entry is no longer valid, however long it had left", () => {
  const ends = new Date("2026-10-31T10:00:00Z");
  assert.equal(vaultStanding(ends, new Date("2026-10-12T10:00:00Z"), "refunded"), "refunded");
  assert.equal(vaultStanding(ends, new Date("2026-12-01T00:00:00Z"), "refunded"), "refunded");
});

test("days left round up, and never go below zero", () => {
  const ends = new Date("2026-10-31T10:00:00Z");
  assert.equal(daysLeft(ends, new Date("2026-10-24T09:00:00Z")), 8);
  assert.equal(daysLeft(ends, new Date("2026-10-31T09:00:00Z")), 1);
  assert.equal(daysLeft(ends, new Date("2026-11-02T00:00:00Z")), 0);
});

test("each kind needs its own fields, and blanks are refused", () => {
  assert.ok(credentialSchema.safeParse({ kind: "login", login: "a@b.c", password: "pw" }).success);
  assert.ok(credentialSchema.safeParse({ kind: "licence_key", key: "AAAA-BBBB" }).success);
  assert.ok(credentialSchema.safeParse({ kind: "invite", note: "Invite sent" }).success);
  assert.ok(!credentialSchema.safeParse({ kind: "login", login: "a@b.c", password: "  " }).success);
  assert.ok(!credentialSchema.safeParse({ kind: "licence_key" }).success);
  assert.ok(!credentialSchema.safeParse({ kind: "admin", key: "x" }).success);
});

test("a refusal never repeats what was typed", () => {
  const typed = "p".repeat(300);
  const result = credentialSchema.safeParse({ kind: "login", login: "a@b.c", password: typed });
  assert.ok(!result.success);
  assert.ok(!JSON.stringify(result.error.issues).includes(typed));
});

test("a credential survives the trip through text, and must match its kind", () => {
  const credential = { kind: "login" as const, login: "a@b.c", password: "pw" };
  assert.deepEqual(parseCredential(serializeCredential(credential), "login"), credential);
  assert.throws(() => parseCredential(serializeCredential(credential), "licence_key"));
  assert.throws(() => parseCredential("not json", "login"));
});
