import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { z } from "zod";
import { emailEnv, pushEnv } from "@/lib/env";
import { derivePushKeys, endpointTag, openSubscription } from "@/lib/push-seal";
import { type SellerAlert, alertEmail, pushPayload, pushSubscriptionSchema } from "@/lib/seller-alerts";
import type { Database } from "@/lib/supabase/database.types";

// Telling the seller, by browser push and email. Nothing
// here reads or moves an order's status: a notification only says where to
// look. None of it throws; a failure is one line in the server log, since the
// queue is the source of truth. Log lines say which channel and the status or
// error name, never a key, an endpoint or the message.

// ───────────────────────────── Browser push ─────────────────────────────

export type PushResult = { sent: number; removed: number; failed: number };

// A push service answering 404 or 410 means the subscription is gone for good
// (the browser unsubscribed, or the seller cleared its data).
const GONE = new Set([404, 410]);

// dropGone removes a dead subscription by its endpoint tag and says whether it
// did; how depends on who is asking (the customer's narrow function, or the
// seller's own delete).
export async function pushToDevices(
  sealed: string[],
  alert: SellerAlert,
  dropGone: (tag: string) => Promise<boolean>,
): Promise<PushResult> {
  const result: PushResult = { sent: 0, removed: 0, failed: 0 };
  if (sealed.length === 0) return result;
  const { publicKey, privateKey, contact } = pushEnv();
  const keys = derivePushKeys(privateKey);
  const payload = pushPayload(alert);

  await Promise.all(
    sealed.map(async (one) => {
      let subscription;
      try {
        subscription = pushSubscriptionSchema.parse(JSON.parse(openSubscription(keys, one)));
      } catch {
        result.failed += 1;
        console.error("push failed: a stored device couldn't be opened (VAPID key changed?); remove it and switch on again");
        return;
      }
      try {
        // Four hours: a payment still waiting by then is in the queue anyway.
        await webpush.sendNotification(subscription, payload, {
          vapidDetails: { subject: contact, publicKey, privateKey },
          TTL: 4 * 60 * 60,
          urgency: "high",
          timeout: 10_000,
        });
        result.sent += 1;
      } catch (error) {
        result.failed += 1;
        if (error instanceof webpush.WebPushError && GONE.has(error.statusCode)) {
          const dropped = await dropGone(endpointTag(keys, subscription.endpoint)).catch(() => false);
          if (dropped) result.removed += 1;
          console.error(`push failed: ${error.statusCode}, device expired, ${dropped ? "removed" : "and removing it failed"}`);
        } else if (error instanceof webpush.WebPushError) {
          console.error(`push failed: ${error.statusCode}`);
        } else {
          console.error(`push failed: ${error instanceof Error ? error.name : "unknown error"}`);
        }
      }
    }),
  );
  return result;
}

// ───────────────────────────── Email ─────────────────────────────

// Resend's shared sender: without a verified domain of our own this is the
// only "from" the free plan accepts.
const FROM = "Kunji <onboarding@resend.dev>";
const resendError = z.object({ name: z.string() });

// One HTTP call to Resend. Its error name (invalid_api_key,
// validation_error…) says what went wrong without repeating anything sent.
export async function emailSeller(alert: SellerAlert): Promise<boolean> {
  const { apiKey, to } = emailEnv();
  const { subject, text } = alertEmail(alert);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return true;
    const body = resendError.safeParse(await response.json().catch(() => null));
    console.error(`email failed: ${response.status} ${body.success ? body.data.name : "no reason given"}`);
  } catch (error) {
    console.error(`email failed: ${error instanceof Error ? error.name : "unknown error"}`);
  }
  return false;
}

// ───────────────────────────── When proof lands ─────────────────────────────

// Runs as the customer who submitted the proof, after their response. The
// switches and the sealed subscriptions come through proof_alert_targets,
// which answers only the order's own customer while it's verifying.
export async function alertSellerOfProof(
  supabase: SupabaseClient<Database>,
  orderId: string,
  alert: SellerAlert,
): Promise<void> {
  const { data, error } = await supabase.rpc("proof_alert_targets", { p_order_id: orderId });
  if (error) {
    console.error(`push and email skipped: couldn't read the notification settings (${error.code ?? "no code"})`);
    return;
  }
  const targets = data[0];
  // No row: the order isn't verifying any more (already decided), so there's
  // nothing to check.
  if (!targets) return;

  await Promise.all([
    targets.email_on ? emailSeller(alert) : null,
    targets.push_on
      ? pushToDevices(targets.subscriptions, alert, async (tag) => {
          const { error: dropError } = await supabase.rpc("drop_push_subscription", {
            p_order_id: orderId,
            p_endpoint_tag: tag,
          });
          return !dropError;
        })
      : null,
  ]);
}
