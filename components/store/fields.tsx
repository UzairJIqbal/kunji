import type { FormState } from "@/lib/catalogue";

// Storefront controls, sized for a thumb on a 360px phone: 48px tall, 16px
// text so the phone doesn't zoom in on focus. Blue only on what can be tapped,
// red only on a field the server refused.

export const storeInputClass =
  "h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring aria-invalid:border-danger";

export const storeLabelClass = "text-sm font-medium";

export const storeHintClass = "text-sm text-muted-foreground";

export const primaryButtonClass =
  "inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60";

export const textLinkClass =
  "inline-flex min-h-11 items-center rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// The admin form's error and message, at a size readable on a phone. The ID is
// the one invalidProps points aria-describedby at. Not imported from the admin
// form parts: those are client code, and server pages read this file too.
export function StoreFieldError({ id, errors }: { id: string; errors: string[] | undefined }) {
  if (!errors?.[0]) return null;
  return (
    <p id={`${id}-error`} className="text-sm text-danger">
      {errors[0]}
    </p>
  );
}

export function StoreFormMessage({ state }: { state: FormState }) {
  return (
    <p role="status" className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>
      {state.message}
    </p>
  );
}
