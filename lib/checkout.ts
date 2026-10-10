import { z } from "zod";
// Relative, with its extension, so the tests can load this file directly.
import type { PaymentMethod } from "./catalogue.ts";

// What a customer types at checkout and on the payment screen, checked on the
// server. The browser never sends a price or a status: the plan's ID and the
// proof are all it says.

export const RECEIPT_BUCKET = "receipts";
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // the bucket's own limit

// ───────────────────────────── Phone numbers ─────────────────────────────

// Pakistani mobiles are written every way: 0300 1234567, +92 300 1234567,
// 923001234567. Returns the one form wa.me takes, or null for anything that
// isn't a mobile.
export function normaliseMobile(input: string): string | null {
  const squashed = input.replace(/[\s()-]/g, "");
  const match = /^(?:\+92|0092|92|0)?(3\d{9})$/.exec(squashed);
  return match ? `92${match[1]}` : null;
}

// How a wallet app and its SMS show the same number, which is what the seller
// compares a payment against.
export function localMobile(international: string): string {
  return `0${international.slice(2)}`;
}

export function formatMobile(international: string): string {
  const local = localMobile(international);
  return `${local.slice(0, 4)} ${local.slice(4)}`;
}

// ───────────────────────────── Transaction IDs ─────────────────────────────

// Spaces gone and in capitals, as the database stores them, so an ID typed
// "ab 12" can't slip past the one already used as "AB12".
export function normaliseTransactionId(input: string): string {
  return input.replace(/\s/g, "").toUpperCase();
}

const transactionId = z
  .string({ error: "Transaction ID is required" })
  .default("")
  .transform(normaliseTransactionId)
  .pipe(
    z
      .string()
      .min(1, "Transaction ID is required")
      .max(64, "Transaction ID is at most 64 characters")
      .regex(/^[A-Z0-9-]+$/, "Transaction ID is letters and digits, as your wallet shows it"),
  );

const walletSender = z
  .string({ error: "The number you paid from is required" })
  .default("")
  .transform((value, ctx) => {
    if (value.trim() === "") {
      ctx.addIssue({ code: "custom", message: "The number you paid from is required" });
      return z.NEVER;
    }
    const international = normaliseMobile(value);
    if (!international) {
      ctx.addIssue({
        code: "custom",
        message: "Enter the mobile number you paid from, like 0300 1234567",
      });
      return z.NEVER;
    }
    return localMobile(international);
  });

const bankSender = z
  .string({ error: "The account you paid from is required" })
  .default("")
  .transform((value) => value.replace(/\s/g, "").toUpperCase())
  .pipe(
    z
      .string()
      .min(1, "The account you paid from is required")
      .regex(/^[A-Z0-9]{6,34}$/, "Enter the account number or IBAN you paid from"),
  );

// The receipt is a file and is checked on its own; these are the typed fields.
export function proofSchema(method: PaymentMethod) {
  return z.object({
    transactionId,
    senderNumber: method === "bank_transfer" ? bankSender : walletSender,
  });
}

// ───────────────────────────── Activation email ─────────────────────────────

// Typed twice because a typo here activates someone else's account. Compared
// ignoring case and stray spaces, which no mail provider tells apart.
const emailPair = z.object({
  email: z.string({ error: "Activation email is required" }).trim().toLowerCase().default(""),
  emailAgain: z.string({ error: "Type the email again" }).trim().toLowerCase().default(""),
});

type EmailPair = z.infer<typeof emailPair>;

function checkEmails(value: EmailPair, ctx: z.RefinementCtx) {
  if (value.email === "") {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Activation email is required" });
  } else if (value.email.length > 254 || !z.email().safeParse(value.email).success) {
    ctx.addIssue({
      code: "custom",
      path: ["email"],
      message: "Enter the whole email address, like name@gmail.com",
    });
  } else if (value.emailAgain !== value.email) {
    ctx.addIssue({
      code: "custom",
      path: ["emailAgain"],
      message: "The two emails don't match",
    });
  }
}

export const activationEmailSchema = emailPair.superRefine(checkEmails);

// What checkout asks depends on the product (does it need an email?) and the
// customer (have they given a WhatsApp number before?), both read on the server.
export function checkoutSchema(asks: { email: boolean; whatsapp: boolean }) {
  return emailPair
    .extend({
      planId: z.uuid({ error: "The request was malformed" }),
      whatsapp: z.string({ error: "WhatsApp number is required" }).default(""),
    })
    .superRefine((value, ctx) => {
      if (asks.email) checkEmails(value, ctx);
      if (asks.whatsapp && normaliseMobile(value.whatsapp) === null) {
        ctx.addIssue({
          code: "custom",
          path: ["whatsapp"],
          message:
            value.whatsapp.trim() === ""
              ? "WhatsApp number is required"
              : "Enter a Pakistani mobile number, like 0300 1234567",
        });
      }
    })
    .transform((value) => ({
      planId: value.planId,
      activationEmail: asks.email ? value.email : null,
      whatsapp: asks.whatsapp ? normaliseMobile(value.whatsapp) : null,
    }));
}
