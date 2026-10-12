"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { registerPushDevice } from "@/lib/actions/seller-alerts";

// The browser's own push setup, which only the browser can do: ask for
// permission, register the service worker, subscribe with the site's public
// key, then hand the subscription to the server to seal and store.
export function PushSwitch({ publicKey }: { publicKey: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function switchOn() {
    startTransition(async () => {
      setResult(await subscribeThisBrowser(publicKey));
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="xs" disabled={pending} onClick={switchOn}>
        {pending ? "Switching on…" : "Switch on this browser"}
      </Button>
      {result && (
        <span role="status" className={`text-xs ${result.ok ? "text-success" : "text-danger"}`}>
          {result.message}
        </span>
      )}
    </div>
  );
}

async function subscribeThisBrowser(publicKey: string): Promise<{ ok: boolean; message: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { ok: false, message: "This browser can't receive push notifications." };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      message: "Notifications are blocked for this site. Allow them in the browser's site settings, then try again.",
    };
  }
  try {
    // Scoped to the admin area, so the storefront never runs under it.
    await navigator.serviceWorker.register("/sw.js", { scope: "/admin/", updateViaCache: "none" });
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: fromBase64Url(publicKey),
      }));
    return await registerPushDevice(subscription.toJSON());
  } catch (error) {
    return {
      ok: false,
      message: `Not switched on: ${error instanceof Error ? error.message : "the browser refused"}.`,
    };
  }
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
