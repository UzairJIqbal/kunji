import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

// Seals the seller's push subscriptions before they reach the database, and
// opens them again to send. A subscription is the address of a browser, not a
// customer's credential, so it doesn't go through the vault's module or key.
//
// The key is derived from the VAPID private key rather than being another
// value to manage: a subscription is useless without that key anyway, and
// changing it means every browser has to switch on again in any case.
//
// AES-256-GCM, stored as "v1:" then base64 of IV (12 bytes), tag (16) and
// ciphertext, matching the push_subscriptions column check. The endpoint tag
// is an HMAC of the endpoint under a second derived key: stable for the same
// browser, and impossible to compute without opening the subscription first.
//
// No error raised here carries the key, the subscription or the ciphertext.

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const AAD = Buffer.from(`kunji-push:${VERSION}`, "utf8");

export class PushSealError extends Error {}

export type PushKeys = { seal: Buffer; tag: Buffer };

export function derivePushKeys(vapidPrivateKey: string): PushKeys {
  const secret = Buffer.from(vapidPrivateKey, "base64url");
  if (secret.length !== 32) throw new PushSealError("VAPID private key must be 32 bytes");
  const derive = (info: string) => Buffer.from(hkdfSync("sha256", secret, Buffer.alloc(0), info, 32));
  return { seal: derive("kunji push subscription seal"), tag: derive("kunji push endpoint tag") };
}

export function sealSubscription(keys: PushKeys, plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keys.seal, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(AAD);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")}`;
}

export function openSubscription(keys: PushKeys, sealed: string): string {
  const prefix = `${VERSION}:`;
  if (!sealed.startsWith(prefix)) throw new PushSealError("Unknown subscription format");
  const raw = Buffer.from(sealed.slice(prefix.length), "base64");
  if (raw.length <= IV_BYTES + TAG_BYTES) throw new PushSealError("Subscription is too short");
  try {
    const decipher = createDecipheriv("aes-256-gcm", keys.seal, raw.subarray(0, IV_BYTES), {
      authTagLength: TAG_BYTES,
    });
    decipher.setAAD(AAD);
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
  } catch {
    throw new PushSealError("Subscription could not be opened");
  }
}

export function endpointTag(keys: PushKeys, endpoint: string): string {
  return createHmac("sha256", keys.tag).update(endpoint, "utf8").digest("hex");
}
