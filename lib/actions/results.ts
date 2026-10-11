import type { FormState } from "@/lib/catalogue";

// What the order actions hand back to their forms. Each decision is one
// database function, so the codes here are the ones those functions raise.

type DbError = { code?: string; message: string };

export const MALFORMED = "Not saved: the request was malformed. Reload the page and try again.";

export function failed(message: string, prev: FormState, fieldErrors: FormState["fieldErrors"] = {}): FormState {
  return { ok: false, message, fieldErrors, version: prev.version };
}

export function saved(message: string, prev: FormState): FormState {
  return { ok: true, message, fieldErrors: {}, version: prev.version + 1 };
}

export function decisionFailure(error: DbError, prev: FormState): FormState {
  switch (error.code) {
    case "42501":
      return failed("Not saved: this account isn't an admin.", prev);
    case "P0002":
      return failed("Not saved: this order no longer exists.", prev);
    // Another device decided first, or this page was stale.
    case "KJ006":
      return failed("This order has already moved on. Reload to see where it is.", prev);
    default:
      return failed(`Not saved: ${error.message}`, prev);
  }
}
