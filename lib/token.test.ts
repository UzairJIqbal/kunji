import assert from "node:assert/strict";
import { test } from "node:test";
import { tokenSecondsLeft } from "./token.ts";

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (payload: object) => `${base64url({ alg: "RS256" })}.${base64url(payload)}.signature`;

const now = Date.UTC(2026, 9, 10, 14, 0, 0);
const nowSeconds = now / 1000;

test("a token's remaining life is read from its exp claim", () => {
  assert.equal(tokenSecondsLeft(jwt({ exp: nowSeconds + 45 }), now), 45);
  assert.equal(tokenSecondsLeft(jwt({ exp: nowSeconds + 45, sub: "user_ü" }), now + 1000), 44);
});

test("an expired token has none left", () => {
  assert.equal(tokenSecondsLeft(jwt({ exp: nowSeconds - 10 }), now), 0);
});

test("a token that can't be read counts as expired", () => {
  assert.equal(tokenSecondsLeft("", now), 0);
  assert.equal(tokenSecondsLeft("not-a-jwt", now), 0);
  assert.equal(tokenSecondsLeft("a.%%%.c", now), 0);
  assert.equal(tokenSecondsLeft(jwt({ sub: "user_1" }), now), 0);
  assert.equal(tokenSecondsLeft(jwt({ exp: "soon" }), now), 0);
});
