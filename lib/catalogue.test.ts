import assert from "node:assert/strict";
import { test } from "node:test";
import { paymentAccountSchema, planSchema, productSchema, refusal } from "./catalogue.ts";

const product = {
  name: "Test product",
  category: "Streaming",
  accountType: "own_account",
  needsActivationEmail: false,
};

test("a product without an account type is refused, naming the field", () => {
  const result = productSchema.safeParse({ ...product, accountType: undefined });
  assert.equal(result.success, false);
  if (result.success) return;
  const state = refusal(result.error);
  assert.deepEqual(state.fieldErrors.accountType, ["Account type is required"]);
  assert.match(state.message ?? "", /Account type is required/);
});

test("an account type that isn't one of the three is refused", () => {
  assert.equal(productSchema.safeParse({ ...product, accountType: "lifetime" }).success, false);
});

test("a blank plan note is stored as no note", () => {
  const parsed = productSchema.parse({ ...product, planNote: "   " });
  assert.equal(parsed.planNote, null);
  assert.equal(productSchema.parse({ ...product, planNote: " UK only " }).planNote, "UK only");
});

const plan = {
  durationDays: "30",
  warrantyDays: "0",
  supplierPrice: "400",
  margin: "175",
  numastoreUrl: "https://numastore.pro/product/123",
};

test("plan numbers arrive as digits and leave as integers", () => {
  assert.deepEqual(planSchema.parse(plan), {
    durationDays: 30,
    warrantyDays: 0,
    supplierPrice: 400,
    margin: 175,
    numastoreUrl: "https://numastore.pro/product/123",
  });
});

test("a plan needs a duration and a warranty, but zero warranty is fine", () => {
  assert.equal(planSchema.safeParse({ ...plan, durationDays: "" }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, durationDays: "0" }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, warrantyDays: undefined }).success, false);
});

test("money is whole rupees as typed, never coerced", () => {
  for (const supplierPrice of ["12.5", "-4", "1e3", "Rs 400", "0"]) {
    assert.equal(planSchema.safeParse({ ...plan, supplierPrice }).success, false, supplierPrice);
  }
});

test("the link must be https on numastore itself", () => {
  const ok = ["https://numastore.pro/x", "https://www.numastore.pro/x?y=1"];
  const bad = [
    "http://numastore.pro/x",
    "https://numastore.pro.evil.example/x",
    "https://evilnumastore.pro/x",
    "javascript:alert(1)",
    "numastore.pro/x",
  ];
  for (const numastoreUrl of ok) {
    assert.equal(planSchema.safeParse({ ...plan, numastoreUrl }).success, true, numastoreUrl);
  }
  for (const numastoreUrl of bad) {
    assert.equal(planSchema.safeParse({ ...plan, numastoreUrl }).success, false, numastoreUrl);
  }
});

test("a bank name goes with a bank transfer and nothing else", () => {
  const wallet = { method: "easypaisa", accountTitle: "A", accountNumber: "0300", bankName: "X" };
  assert.equal(paymentAccountSchema.parse(wallet).bankName, null);

  const bank = { ...wallet, method: "bank_transfer", bankName: "" };
  const result = paymentAccountSchema.safeParse(bank);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(refusal(result.error).fieldErrors.bankName, [
      "Bank name is required for a bank transfer",
    ]);
  }
  assert.equal(paymentAccountSchema.parse({ ...bank, bankName: "Meezan" }).bankName, "Meezan");
});
