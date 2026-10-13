import type { FormState } from "@/lib/catalogue";

// Storefront controls, sized for a thumb on a 360px phone: 48px tall, 16px
// text so the phone doesn't zoom in on focus. Olive only on what can be tapped,
// red only on a field the server refused.

export const storeInputClass =
  "field h-12 px-3 text-base";

export const storeLabelClass = "text-sm font-medium";

export const storeHintClass = "text-sm text-muted-foreground";

export const primaryButtonClass =
  "btn-primary min-h-12 w-full text-base";

export const textLinkClass =
  "text-link inline-flex min-h-11 items-center";

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
