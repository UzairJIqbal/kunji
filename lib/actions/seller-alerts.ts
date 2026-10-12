"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { MALFORMED, failed, saved } from "@/lib/actions/results";
import { type FormState, flagSchema, idSchema } from "@/lib/catalogue";
import { pushEnv, siteUrl } from "@/lib/env";
import { emailSeller, pushToDevices } from "@/lib/notify-seller";
import { derivePushKeys, endpointTag, sealSubscription } from "@/lib/push-seal";
import { alertChannelSchema, deviceLabel, pushSubscriptionSchema, testAlert } from "@/lib/seller-alerts";
import { createServerSupabase } from "@/lib/supabase/server";

// The seller's notification settings. The push_subscriptions and
// seller_alert_settings policies decide who may do any of this; a refusal
// shows up as no rows changed.

const NOT_ADMIN = "Not saved: this account isn't an admin.";

// The browser hands over its PushSubscription; it's checked, sealed and stored
// here, so the database never sees an endpoint in the clear. The same browser
// registering again replaces its own row.
export async function registerPushDevice(raw: unknown): Promise<{ ok: boolean; message: string }> {
  const parsed = pushSubscriptionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Not saved: this browser sent a subscription that didn't look right." };
  const subscription = parsed.data;

  const keys = derivePushKeys(pushEnv().privateKey);
  const label = deviceLabel((await headers()).get("user-agent"));
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        subscription: sealSubscription(keys, JSON.stringify(subscription)),
        endpoint_tag: endpointTag(keys, subscription.endpoint),
        label,
      },
      { onConflict: "endpoint_tag" },
    )
    .select("id");
  if (error) return { ok: false, message: error.code === "42501" ? NOT_ADMIN : `Not saved: ${error.message}` };
  if (data.length === 0) return { ok: false, message: NOT_ADMIN };

  refresh();
  return { ok: true, message: `Switched on: ${label}.` };
}

export async function removePushDevice(deviceId: string, prev: FormState): Promise<FormState> {
  const id = idSchema.safeParse(deviceId);
  if (!id.success) return failed(MALFORMED, prev);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("push_subscriptions").delete().eq("id", id.data).select("id");
  if (error) return failed(`Not removed: ${error.message}`, prev);
  if (data.length === 0) return failed("Not removed: this account isn't an admin, or the device is already gone.", prev);

  refresh();
  return saved("Removed.", prev);
}

export async function setAlertChannel(channel: string, on: boolean, prev: FormState): Promise<FormState> {
  const which = alertChannelSchema.safeParse(channel);
  const flag = flagSchema.safeParse(on);
  if (!which.success || !flag.success) return failed(MALFORMED, prev);
  const change = {
    push: { push_on: flag.data },
    email: { email_on: flag.data },
  }[which.data];

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("seller_alert_settings")
    .update(change)
    .eq("id", true)
    .select("id");
  if (error) return failed(error.code === "42501" ? NOT_ADMIN : `Not saved: ${error.message}`, prev);
  if (data.length === 0) return failed(NOT_ADMIN, prev);

  refresh();
  return saved("Saved.", prev);
}

// Sends a plainly-labelled test through every channel that's switched on, the
// same way a payment would, and says how each one went. The settings read is
// also the admin check: anyone else gets no row and sends nothing.
export async function sendTestAlert(prev: FormState): Promise<FormState> {
  const supabase = await createServerSupabase();
  const [settings, devices] = await Promise.all([
    supabase.from("seller_alert_settings").select("push_on, email_on").maybeSingle(),
    supabase.from("push_subscriptions").select("subscription").order("created_at").limit(20),
  ]);
  if (settings.error || devices.error) return failed("Not sent: couldn't read the notification settings.", prev);
  if (!settings.data) return failed("Not sent: this account isn't an admin.", prev);

  const alert = testAlert(siteUrl());
  const { push_on, email_on } = settings.data;
  const [push, email] = await Promise.all([
    push_on
      ? pushToDevices(
          devices.data.map((d) => d.subscription),
          alert,
          async (tag) => {
            const { data, error } = await supabase.from("push_subscriptions").delete().eq("endpoint_tag", tag).select("id");
            return !error && data.length > 0;
          },
        )
      : null,
    email_on ? emailSeller(alert) : null,
  ]);

  const parts = [
    push === null
      ? "browser off"
      : devices.data.length === 0
        ? "browser: no devices"
        : `browser: ${push.sent} of ${devices.data.length} devices${push.removed > 0 ? `, ${push.removed} expired and removed` : ""}`,
    email === null ? "email off" : email ? "email sent" : "email failed",
  ];
  const anyFailed = (push !== null && push.failed > 0) || email === false;
  if (push?.removed) refresh();
  const message = `${parts.join("; ")}.${anyFailed ? " The server log says why." : ""}`;
  return anyFailed ? failed(message, prev) : saved(message, prev);
}
