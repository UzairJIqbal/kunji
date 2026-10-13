import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

// The one place a credential is encrypted or decrypted, and the one place the
// key is read. Nothing else in the app touches either.
//
// AES-256-GCM: authenticated, so a ciphertext that was changed, or moved onto
// another order, fails to open rather than opening to rubbish. Each order's id
// is bound in as additional data for exactly that reason. A login bought ahead
// into stock is sealed to its stock item's id instead, and keeps that seal
// when it's delivered, so delivery never needs the plain text.
//
// Stored as "v1:" then base64 of IV (12 bytes), tag (16) and ciphertext. The
// version is there so a later key or format can sit beside this one.
//
// No error raised here ever carries the key, the plain text or the ciphertext:
// errors end up in logs.

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export class VaultKeyError extends Error {}
export class VaultOpenError extends Error {}

// The key as it sits in the environment: 32 random bytes in base64, as
// `openssl rand -base64 32` prints them.
export function parseVaultKey(value: string | undefined): Buffer {
  if (!value || value.trim() === "") {
    throw new VaultKeyError("VAULT_KEY is not set");
  }
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    throw new VaultKeyError("VAULT_KEY is not base64");
  }
  const key = Buffer.from(trimmed, "base64");
  if (key.length !== KEY_BYTES) {
    throw new VaultKeyError(`VAULT_KEY must be ${KEY_BYTES} bytes, e.g. from \`openssl rand -base64 32\``);
  }
  return key;
}

function additionalData(orderId: string): Buffer {
  return Buffer.from(`kunji-vault:${VERSION}:${orderId}`, "utf8");
}

export function sealCredential(key: Buffer, orderId: string, plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(additionalData(orderId));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, tag, body]).toString("base64")}`;
}

export function openCredential(key: Buffer, orderId: string, sealed: string): string {
  const prefix = `${VERSION}:`;
  if (!sealed.startsWith(prefix)) throw new VaultOpenError("Unknown vault format");
  const raw = Buffer.from(sealed.slice(prefix.length), "base64");
  if (raw.length <= IV_BYTES + TAG_BYTES) throw new VaultOpenError("Vault entry is too short");

  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = raw.subarray(IV_BYTES + TAG_BYTES);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(additionalData(orderId));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    // Node's own message is generic, but it's replaced anyway so nothing about
    // the entry can leak through it.
    throw new VaultOpenError("Vault entry could not be opened");
  }
}

// The app's way in: the key is read from the server's environment on each
// call, never kept in a module variable that a stray import could reach.
export function encryptCredential(orderId: string, plain: string): string {
  return sealCredential(parseVaultKey(process.env.VAULT_KEY), orderId, plain);
}

export function decryptCredential(orderId: string, sealed: string): string {
  return openCredential(parseVaultKey(process.env.VAULT_KEY), orderId, sealed);
}

// A stock login's fingerprint, so a repeat is caught without anything ever
// comparing plain text. An HMAC under a key derived from the vault key: the
// database alone can't test a guessed password against it. The login is
// compared ignoring case and surrounding space, as a sign-in would; the
// password exactly.
export function fingerprintCredential(key: Buffer, login: string, password: string): string {
  const fingerprintKey = Buffer.from(hkdfSync("sha256", key, Buffer.alloc(0), "kunji-stock-fingerprint:v1", KEY_BYTES));
  return createHmac("sha256", fingerprintKey)
    .update(login.trim().toLowerCase(), "utf8")
    .update("\u0000", "utf8")
    .update(password, "utf8")
    .digest("hex");
}

export function credentialFingerprint(login: string, password: string): string {
  return fingerprintCredential(parseVaultKey(process.env.VAULT_KEY), login, password);
}
