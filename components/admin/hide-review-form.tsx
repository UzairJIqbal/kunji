"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/catalogue";
import { FieldError, FormMessage, inputClass, invalidProps, useServerForm } from "./form-parts";

// Hiding is the one thing the seller can do to a review: the stars and words
// stay as the customer wrote them, and why it came down is kept with it.
export function HideReviewForm({ action }: { action: (prev: FormState, formData: FormData) => Promise<FormState> }) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);
  const id = `${useId()}-reason`;
  const errors = state.fieldErrors.reason;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-wrap items-start gap-1.5">
      <div className="w-48">
        <label htmlFor={id} className="sr-only">
          Reason for hiding
        </label>
        <input
          id={id}
          name="reason"
          maxLength={300}
          aria-required
          placeholder="Reason for hiding"
          autoComplete="off"
          className={inputClass}
          {...invalidProps(id, errors)}
        />
        <FieldError id={id} errors={errors} />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Hiding…" : "Hide"}
      </Button>
      {!state.ok && state.message && <FormMessage state={state} />}
    </form>
  );
}
