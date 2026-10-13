import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { fingerprintCredential, openCredential, parseVaultKey, sealCredential } from "./vault-crypto.ts";

const key = randomBytes(32);
const order = "4f0c6d0e-6b8a-4d8f-9a63-0b6f0e1f2a3b";
const other = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
const secret = '{"kind":"login","login":"someone@example.com","password":"hunter2-Ünïcode"}';

test("a sealed credential opens to what went in", () => {
  assert.equal(openCredential(key, order, sealCredential(key, order, secret)), secret);
});

test("the ciphertext doesn't contain the plain text, and matches the database's check", () => {
  const sealed = sealCredential(key, order, secret);
  assert.ok(!sealed.includes("hunter2"));
  assert.ok(!Buffer.from(sealed.slice(3), "base64").toString("latin1").includes("hunter2"));
  // The same pattern the vault_entries table holds the column to.
  const check = /^v1:([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  for (const value of [sealed, sealCredential(key, order, "x")]) {
    assert.match(value, check);
    assert.ok(value.length >= 43 && value.length <= 20000);
  }
  assert.doesNotMatch("v1:hunter2 is my password", check);
});

test("sealing twice gives different ciphertexts", () => {
  assert.notEqual(sealCredential(key, order, secret), sealCredential(key, order, secret));
});

test("a changed ciphertext refuses to open", () => {
  const sealed = sealCredential(key, order, secret);
  const raw = Buffer.from(sealed.slice(3), "base64");
  raw[raw.length - 1] ^= 1;
  assert.throws(() => openCredential(key, order, `v1:${raw.toString("base64")}`), /could not be opened/);
});

test("a ciphertext moved onto another order refuses to open", () => {
  const sealed = sealCredential(key, order, secret);
  assert.throws(() => openCredential(key, other, sealed), /could not be opened/);
});

test("the wrong key refuses to open, and says nothing about the entry", () => {
  const sealed = sealCredential(key, order, secret);
  assert.throws(
    () => openCredential(randomBytes(32), order, sealed),
    (error: Error) => !error.message.includes(sealed) && !error.message.includes("hunter2"),
  );
});

test("an unknown format or a stub refuses to open", () => {
  assert.throws(() => openCredential(key, order, "hunter2"), /Unknown vault format/);
  assert.throws(() => openCredential(key, order, "v1:AAAA"), /too short/);
});

test("the key must be 32 bytes of base64, and a refusal never repeats it", () => {
  const good = randomBytes(32).toString("base64");
  assert.equal(parseVaultKey(good).length, 32);
  assert.equal(parseVaultKey(` ${good}\n`).length, 32);
  assert.throws(() => parseVaultKey(undefined), /not set/);
  assert.throws(() => parseVaultKey(""), /not set/);
  const short = randomBytes(16).toString("base64");
  assert.throws(
    () => parseVaultKey(short),
    (error: Error) => /32 bytes/.test(error.message) && !error.message.includes(short),
  );
  assert.throws(() => parseVaultKey("not base64 at all!"), /not base64/);
});

test("a fingerprint is the same for the same login, whatever its case or spacing", () => {
  const a = fingerprintCredential(key, "Someone@Example.com ", "hunter2");
  assert.equal(a, fingerprintCredential(key, "someone@example.com", "hunter2"));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.ok(!a.includes("hunter2"));
});

test("a fingerprint changes with the password, the key, or where login ends", () => {
  const a = fingerprintCredential(key, "someone@example.com", "hunter2");
  assert.notEqual(a, fingerprintCredential(key, "someone@example.com", "Hunter2"));
  assert.notEqual(a, fingerprintCredential(randomBytes(32), "someone@example.com", "hunter2"));
  assert.notEqual(
    fingerprintCredential(key, "ab", "c"),
    fingerprintCredential(key, "a", "bc"),
  );
});
