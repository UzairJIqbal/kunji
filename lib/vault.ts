import { z } from "zod";
// Relative, with their extensions, so the tests can load this file directly.
import { requiredText } from "./catalogue.ts";
import type { StatusTone } from "./order-status.ts";
import { Constants, type Database } from "./supabase/database.types.ts";

export type CredentialKind = Database["public"]["Enums"]["credential_kind"];
export const credentialKinds = Constants.public.Enums.credential_kind;

export const credentialKindLabel: Record<CredentialKind, string> = {
  login: "Login and password",
  licence_key: "Licence key",
  invite: "Invite",
};

// ───────────────────────────── What was delivered ─────────────────────────────

// What the seller pastes from numastore, checked on the server. Every message
// names its field and never repeats what was typed: a refusal is shown on
// screen and may be logged, and a password must reach neither.
export const credentialSchema = z.discriminatedUnion(
  "kind",
  [
    z.object({
      kind: z.literal("login"),
      login: requiredText("Login", 254),
      password: requiredText("Password", 256),
    }),
    z.object({
      kind: z.literal("licence_key"),
      key: requiredText("Licence key", 1000),
    }),
    z.object({
      kind: z.literal("invite"),
      note: requiredText("Invite note", 2000),
    }),
  ],
  { error: "Pick what numastore delivered" },
);
export type Credential = z.infer<typeof credentialSchema>;

// The credential as it's encrypted: JSON of exactly these fields, so a reveal
// gets back the same shape it was delivered in.
export function serializeCredential(credential: Credential): string {
  return JSON.stringify(credential);
}

// After decryption. The kind stored beside the entry must agree with the kind
// inside it; anything else means the entry isn't what it says it is.
export function parseCredential(plain: string, kind: CredentialKind): Credential {
  let value: unknown;
  try {
    value = JSON.parse(plain);
  } catch {
    throw new Error("Vault entry is not a credential");
  }
  const parsed = credentialSchema.safeParse(value);
  if (!parsed.success || parsed.data.kind !== kind) {
    throw new Error("Vault entry is not a credential");
  }
  return parsed.data;
}

// ───────────────────────────── Dates ─────────────────────────────

const DAY_MS = 86_400_000;

// A subscription becomes "expiring soon" this many days before it ends.
export const EXPIRING_SOON_DAYS = 7;

// Both run from the delivery in Kunji: the day the customer could first use
// it, and the day numastore's own warranty starts too.
export function vaultDates(
  deliveredAt: string | Date,
  durationDays: number,
  warrantyDays: number,
): { expiresAt: Date; warrantyEndsAt: Date } {
  const from = typeof deliveredAt === "string" ? new Date(deliveredAt) : deliveredAt;
  if (Number.isNaN(from.getTime())) throw new Error(`Not a time: ${String(deliveredAt)}`);
  for (const days of [durationDays, warrantyDays]) {
    if (!Number.isInteger(days) || days < 0) throw new Error(`Not a number of days: ${days}`);
  }
  return {
    expiresAt: new Date(from.getTime() + durationDays * DAY_MS),
    warrantyEndsAt: new Date(from.getTime() + warrantyDays * DAY_MS),
  };
}

export type VaultStanding = "active" | "expiring_soon" | "expired";

export function vaultStanding(expiresAt: Date, now: Date): VaultStanding {
  const left = expiresAt.getTime() - now.getTime();
  if (left <= 0) return "expired";
  if (left <= EXPIRING_SOON_DAYS * DAY_MS) return "expiring_soon";
  return "active";
}

export const vaultStandingBadge: Record<VaultStanding, { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "success" },
  expiring_soon: { label: "Expiring soon", tone: "warning" },
  expired: { label: "Expired", tone: "plain" },
};

// Whole days left, rounded up: 6 days and an hour is "7 days left", and the
// last few hours are "1 day left" rather than 0.
export function daysLeft(until: Date, now: Date): number {
  return Math.max(0, Math.ceil((until.getTime() - now.getTime()) / DAY_MS));
}
