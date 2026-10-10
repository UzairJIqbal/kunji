"use client";

import { type FormEvent, startTransition, useActionState } from "react";
import { type FormState, emptyFormState } from "@/lib/catalogue";

// Dense admin inputs. A red border is the only colour, and only on a field the
// server refused.
export const inputClass =
  "h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring aria-invalid:border-danger";
export const textareaClass =
  "w-full min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-[13px] leading-5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring aria-invalid:border-danger";
export const labelClass = "text-xs font-medium";

// Submits through a transition instead of letting the form post itself, because
// React clears a form after its action runs: a refused save would otherwise
// throw away everything the seller typed. The browser's own validation is off
// (noValidate on each form) so the server's message is the one shown.
export function useServerForm(
  action: (prev: FormState, formData: FormData) => Promise<FormState>,
) {
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }
  return { state, formAction, onSubmit, pending };
}

export function errorId(fieldId: string) {
  return `${fieldId}-error`;
}

export function FieldError({ id, errors }: { id: string; errors: string[] | undefined }) {
  if (!errors?.[0]) return null;
  return (
    <p id={errorId(id)} className="mt-0.5 text-xs text-danger">
      {errors[0]}
    </p>
  );
}

// What the server said about the last save, read out to screen readers too.
export function FormMessage({ state }: { state: FormState }) {
  return (
    <p role="status" className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>
      {state.message}
    </p>
  );
}

export function invalidProps(id: string, errors: string[] | undefined) {
  return errors?.[0] ? { "aria-invalid": true, "aria-describedby": errorId(id) } : {};
}
