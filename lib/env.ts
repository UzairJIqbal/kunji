import { z } from "zod";
import { parseVaultKey } from "./vault-crypto";

// Public values are read with literal `process.env.NEXT_PUBLIC_*` so Next can
// inline them into the browser bundle; a dynamic lookup would come back empty.
const publicSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith("sb_publishable_"),
});

const serverSchema = z.object({
  CLERK_SECRET_KEY: z.string().startsWith("sk_"),
  // The seller's WhatsApp, as wa.me wants it: 92 then the mobile number, no
  // leading zero, no plus. "03001234567" would open a chat with nobody.
  WHATSAPP_NUMBER: z.string().regex(/^923\d{9}$/, "92 then the mobile number, e.g. 923001234567"),
  // Where links in the seller's notifications point. Set here rather than taken
  // from the request, so a forged Host header can't put someone else's link on
  // the seller's screen.
  SITE_URL: z.url({ protocol: /^https?$/ }),
  // Web Push's VAPID pair, base64url as `pnpm exec web-push generate-vapid-keys`
  // prints it. The public key goes to the seller's browser; the private one
  // never leaves the server, and also seals the stored subscriptions.
  VAPID_PUBLIC_KEY: z.string().regex(/^[A-Za-z0-9_-]{87}$/, "the public key from `web-push generate-vapid-keys`"),
  VAPID_PRIVATE_KEY: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "the private key from `web-push generate-vapid-keys`"),
  // Resend's free plan, without a verified domain, only delivers to the Resend
  // account's own address, so this is that address.
  RESEND_API_KEY: z.string().startsWith("re_", "a Resend API key, starting re_"),
  SELLER_EMAIL: z.email(),
  // Encrypts every credential in the vault. Checked here so the app refuses
  // to start without it; only lib/vault-crypto.ts ever reads it. The message
  // is the key parser's own, which never repeats the value.
  VAULT_KEY: z.string({ error: "VAULT_KEY is not set" }).check((ctx) => {
    try {
      parseVaultKey(ctx.value);
    } catch (error) {
      const message = error instanceof Error ? error.message : "VAULT_KEY is malformed";
      // input is left blank so the key never lands in the issue itself.
      ctx.issues.push({ code: "custom", input: "", message });
    }
  }),
});

function fail(error: z.ZodError): never {
  const lines = error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
  throw new Error(
    `Missing or malformed environment variables (check .env.local):\n${lines.join("\n")}`,
  );
}

const parsedPublic = publicSchema.safeParse({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
if (!parsedPublic.success) fail(parsedPublic.error);

export const publicEnv = parsedPublic.data;

function parseServerEnv() {
  const parsed = serverSchema.safeParse({
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    WHATSAPP_NUMBER: process.env.WHATSAPP_NUMBER,
    SITE_URL: process.env.SITE_URL,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SELLER_EMAIL: process.env.SELLER_EMAIL,
    VAULT_KEY: process.env.VAULT_KEY,
  });
  if (!parsed.success) fail(parsed.error);
  return parsed.data;
}

// Called from next.config.ts so `next dev` and `next build` refuse to start
// with a blank or missing value, instead of failing on the first request.
export function assertServerEnv(): void {
  parseServerEnv();
}

export function whatsappNumber(): string {
  return parseServerEnv().WHATSAPP_NUMBER;
}

export function siteUrl(): string {
  return parseServerEnv().SITE_URL;
}

export function pushEnv() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SELLER_EMAIL } = parseServerEnv();
  return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, contact: `mailto:${SELLER_EMAIL}` };
}

// Only the public half, for the page that switches a browser on.
export function vapidPublicKey(): string {
  return parseServerEnv().VAPID_PUBLIC_KEY;
}

export function emailEnv() {
  const { RESEND_API_KEY, SELLER_EMAIL } = parseServerEnv();
  return { apiKey: RESEND_API_KEY, to: SELLER_EMAIL };
}
