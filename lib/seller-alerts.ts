import { z } from "zod";

// What the seller hears when proof lands, the same on every channel: the
// title, one line saying what to look for, and the queue's link. Built by
// newProofAlert, so it can only ever hold an order number, amount and method.
export type SellerAlert = { title: string; message: string; click: string };

export const alertChannels = ["push", "email"] as const;
export type AlertChannel = (typeof alertChannels)[number];
export const alertChannelSchema = z.enum(alertChannels);

export const alertChannelLabel: Record<AlertChannel, string> = {
  push: "Browser notifications",
  email: "Email",
};

// A browser's PushSubscription as toJSON() gives it. The server will POST to
// the endpoint, so only https is taken; the keys are base64url as browsers
// write them.
const base64url = z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).max(200);
export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({ p256dh: base64url, auth: base64url }),
});
export type PushSubscriptionJson = z.infer<typeof pushSubscriptionSchema>;

// A name for the device list, from the user agent the registering request
// came with: enough to tell "Chrome on macOS" from "Chrome on Android".
export function deviceLabel(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /SamsungBrowser\//.test(ua)
        ? "Samsung Internet"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Browser";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  return os ? `${browser} on ${os}` : browser;
}

// What the service worker reads to show the notification.
export function pushPayload(alert: SellerAlert): string {
  return JSON.stringify({ title: alert.title, body: alert.message, url: alert.click });
}

// Plain text, the title as the subject.
export function alertEmail(alert: SellerAlert): { subject: string; text: string } {
  return { subject: alert.title, text: `${alert.message}\n\nCheck it in the queue: ${alert.click}\n` };
}

// The "Send a test" button's message: plainly a test, so it can't be mistaken
// for a payment.
export function testAlert(siteUrl: string): SellerAlert {
  return {
    title: "Test from Kunji",
    message: "Notifications reach this device. No order is waiting because of this.",
    click: new URL("/admin", siteUrl).toString(),
  };
}
