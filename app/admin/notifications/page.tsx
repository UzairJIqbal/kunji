import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/action-button";
import { NotAdmin } from "@/components/admin/not-admin";
import { PushSwitch } from "@/components/admin/push-switch";
import { TestAlertButton } from "@/components/admin/test-alert-button";
import { removePushDevice, setAlertChannel } from "@/lib/actions/seller-alerts";
import { getAlertSettings, listPushDevices } from "@/lib/data/seller-alerts";
import { vapidPublicKey } from "@/lib/env";
import { formatPakistanTime } from "@/lib/format";
import { type AlertChannel, alertChannelLabel, alertChannels } from "@/lib/seller-alerts";

export const metadata: Metadata = { title: "Notifications · Admin · Kunji" };

export default function NotificationsPage() {
  return (
    <main className="mt-3 max-w-3xl">
      <h1 className="font-heading text-xl leading-tight">Notifications</h1>
      <p className="mt-0.5 text-muted-foreground">
        How you hear that a customer has sent payment proof. They only tell you; every payment is
        still approved in the queue.
      </p>
      <Suspense fallback={<p className="mt-2 text-muted-foreground">Loading settings…</p>}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  // The settings row is admin-only by policy, so its absence is the answer.
  const [settings, devices] = await Promise.all([getAlertSettings(), listPushDevices()]);
  if (!settings) return <NotAdmin />;
  const on: Record<AlertChannel, boolean> = {
    push: settings.push_on,
    email: settings.email_on,
  };

  return (
    <>
      <ul className="mt-3 divide-y border-y">
        {alertChannels.map((channel) => (
          <li key={channel} className="flex items-center gap-3 py-1.5">
            <span className="w-44">{alertChannelLabel[channel]}</span>
            <span className={on[channel] ? "w-8 font-medium text-success" : "w-8 text-muted-foreground"}>
              {on[channel] ? "On" : "Off"}
            </span>
            <ActionButton
              action={setAlertChannel.bind(null, channel, !on[channel])}
              label={on[channel] ? "Switch off" : "Switch on"}
              pendingLabel="Saving…"
            />
          </li>
        ))}
      </ul>

      <h2 className="mt-4 text-xs font-medium text-muted-foreground">Devices for browser notifications</h2>
      {devices.length === 0 ? (
        <p className="mt-1.5 text-muted-foreground">No devices yet. Switch this browser on below.</p>
      ) : (
        <ul className="mt-1.5 divide-y border-y">
          {devices.map((device) => (
            <li key={device.id} className="flex items-center gap-3 py-1.5">
              <span className="w-44">{device.label}</span>
              <span className="text-muted-foreground">added {formatPakistanTime(device.created_at)}</span>
              <span className="ml-auto">
                <ActionButton
                  action={removePushDevice.bind(null, device.id)}
                  label="Remove"
                  pendingLabel="Removing…"
                />
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        <PushSwitch publicKey={vapidPublicKey()} />
      </div>

      <h2 className="mt-4 text-xs font-medium text-muted-foreground">Check it works</h2>
      <p className="mt-0.5 text-muted-foreground">
        Sends a test through every channel that&apos;s on. No order is involved.
      </p>
      <div className="mt-1.5">
        <TestAlertButton />
      </div>
    </>
  );
}
