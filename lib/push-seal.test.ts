import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { derivePushKeys, endpointTag, openSubscription, sealSubscription } from "./push-seal.ts";

const vapid = randomBytes(32).toString("base64url");
const keys = derivePushKeys(vapid);
const subscription = JSON.stringify({
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: { p256dh: "BNcR", auth: "tBHI" },
});

test("a sealed subscription opens to what went in, and hides the endpoint", () => {
  const sealed = sealSubscription(keys, subscription);
  assert.equal(openSubscription(keys, sealed), subscription);
  assert.ok(!Buffer.from(sealed.slice(3), "base64").toString("latin1").includes("fcm.googleapis"));
  // The push_subscriptions column check.
  assert.match(sealed, /^v1:[A-Za-z0-9+/]+={0,2}$/);
});

test("another VAPID key can't open it", () => {
  const sealed = sealSubscription(keys, subscription);
  assert.throws(() => openSubscription(derivePushKeys(randomBytes(32).toString("base64url")), sealed));
});

test("a changed ciphertext fails to open, and the error says nothing of it", () => {
  const sealed = sealSubscription(keys, subscription);
  const raw = Buffer.from(sealed.slice(3), "base64");
  raw[raw.length - 1] ^= 1;
  assert.throws(
    () => openSubscription(keys, `v1:${raw.toString("base64")}`),
    (error: Error) => error.message === "Subscription could not be opened",
  );
});

test("the endpoint tag is the same each time, differs per endpoint and key, and fits the column", () => {
  const endpoint = "https://fcm.googleapis.com/fcm/send/abc123";
  assert.equal(endpointTag(keys, endpoint), endpointTag(keys, endpoint));
  assert.notEqual(endpointTag(keys, endpoint), endpointTag(keys, `${endpoint}4`));
  assert.notEqual(endpointTag(keys, endpoint), endpointTag(derivePushKeys(randomBytes(32).toString("base64url")), endpoint));
  assert.match(endpointTag(keys, endpoint), /^[0-9a-f]{64}$/);
});

test("a VAPID key of the wrong length is refused", () => {
  assert.throws(() => derivePushKeys(randomBytes(16).toString("base64url")));
});
