import { z } from "zod";

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
