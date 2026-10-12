import assert from "node:assert/strict";
import { test } from "node:test";
import { alertEmail, deviceLabel, pushPayload, pushSubscriptionSchema } from "./seller-alerts.ts";
import { newProofAlert } from "./verification.ts";

const alert = newProofAlert({ number: 1042, price: 1200, method: "easypaisa" }, "http://localhost:3000");

test("the email is the alert: order number in the subject, amount and method, the queue link", () => {
  const email = alertEmail(alert);
  assert.equal(email.subject, "Payment to check: order #1042");
  assert.equal(email.text, "Rs 1,200 by Easypaisa\n\nCheck it in the queue: http://localhost:3000/admin\n");
});

test("the push payload carries the same three things and nothing else", () => {
  assert.deepEqual(JSON.parse(pushPayload(alert)), {
    title: "Payment to check: order #1042",
    body: "Rs 1,200 by Easypaisa",
    url: "http://localhost:3000/admin",
  });
});

test("devices are named by browser and system", () => {
  assert.equal(
    deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"),
    "Chrome on macOS",
  );
  assert.equal(
    deviceLabel("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"),
    "Chrome on Android",
  );
  assert.equal(
    deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0"),
    "Edge on Windows",
  );
  assert.equal(deviceLabel("Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0"), "Firefox on Linux");
  assert.equal(deviceLabel(null), "Browser");
});

test("a subscription must point at an https push service", () => {
  const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
  assert.ok(pushSubscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys }).success);
  assert.ok(!pushSubscriptionSchema.safeParse({ endpoint: "http://169.254.169.254/latest", keys }).success);
  assert.ok(!pushSubscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: { p256dh: "<script>", auth: "x" } }).success);
});
