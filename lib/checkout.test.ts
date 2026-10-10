import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activationEmailSchema,
  checkoutSchema,
  formatMobile,
  normaliseMobile,
  normaliseTransactionId,
  proofSchema,
} from "./checkout.ts";

const planId = "6f1c2a7e-8a7b-4c1d-9e2f-3a4b5c6d7e8f";

test("every common way of writing a Pakistani mobile comes out the same", () => {
  for (const typed of ["03001234567", "0300 1234567", "0300-1234567", "+92 300 1234567", "923001234567", "00923001234567"]) {
    assert.equal(normaliseMobile(typed), "923001234567", typed);
  }
});

test("a number that isn't a Pakistani mobile is refused", () => {
  for (const typed of ["", "0300123456", "030012345678", "0421234567", "+44 7700 900123", "abc"]) {
    assert.equal(normaliseMobile(typed), null, typed);
  }
});

test("a mobile is shown as people write it", () => {
  assert.equal(formatMobile("923001234567"), "0300 1234567");
});

test("transaction IDs lose their spaces and gain capitals", () => {
  assert.equal(normaliseTransactionId(" ab 12\tcd "), "AB12CD");
});

test("checkout refuses two activation emails that don't match", () => {
  const result = checkoutSchema({ email: true, whatsapp: false }).safeParse({
    planId,
    email: "ali@gmail.com",
    emailAgain: "ali@gmial.com",
  });
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.issues.map((i) => i.path), [["emailAgain"]]);
});

test("matching emails pass, ignoring case and stray spaces", () => {
  const result = checkoutSchema({ email: true, whatsapp: false }).parse({
    planId,
    email: " Ali@Gmail.com",
    emailAgain: "ali@gmail.com ",
  });
  assert.equal(result.activationEmail, "ali@gmail.com");
});

test("an email typed for a product that doesn't need one is dropped", () => {
  const result = checkoutSchema({ email: false, whatsapp: false }).parse({
    planId,
    email: "ali@gmail.com",
    emailAgain: "someone@else.com",
  });
  assert.equal(result.activationEmail, null);
});

test("a first checkout needs a WhatsApp number, stored as wa.me wants it", () => {
  const asks = { email: false, whatsapp: true };
  assert.equal(checkoutSchema(asks).safeParse({ planId }).success, false);
  assert.equal(checkoutSchema(asks).parse({ planId, whatsapp: "0300 1234567" }).whatsapp, "923001234567");
});

test("the browser can't send a price: only the plan is read", () => {
  const result = checkoutSchema({ email: false, whatsapp: false }).parse({ planId, price: "1" });
  assert.deepEqual(result, { planId, activationEmail: null, whatsapp: null });
});

test("proof without the number paid from is refused", () => {
  const result = proofSchema("easypaisa").safeParse({ transactionId: "123456789" });
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.issues.map((i) => i.path), [["senderNumber"]]);
});

test("wallet proof keeps the number as the wallet shows it", () => {
  assert.deepEqual(
    proofSchema("jazzcash").parse({ transactionId: "ab 123", senderNumber: "+92 300 1234567" }),
    { transactionId: "AB123", senderNumber: "03001234567" },
  );
});

test("bank proof takes an account number or IBAN", () => {
  assert.equal(
    proofSchema("bank_transfer").parse({ transactionId: "FT1", senderNumber: "pk36 scbl 0000 0011 2345 6702" }).senderNumber,
    "PK36SCBL0000001123456702",
  );
  assert.equal(proofSchema("bank_transfer").safeParse({ transactionId: "FT1", senderNumber: "12" }).success, false);
});

test("a fixed email is checked the same way as at checkout", () => {
  assert.equal(activationEmailSchema.safeParse({ email: "a@b.co", emailAgain: "a@b.com" }).success, false);
  assert.equal(activationEmailSchema.parse({ email: "A@B.co", emailAgain: "a@b.co" }).email, "a@b.co");
});
