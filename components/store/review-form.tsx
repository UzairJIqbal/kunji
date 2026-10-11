"use client";

import { invalidProps, useServerForm } from "@/components/admin/form-parts";
import type { FormState } from "@/lib/catalogue";
import { ratings, starsLabel } from "@/lib/reviews";
import {
  StoreFieldError as FieldError,
  StoreFormMessage as FormMessage,
  primaryButtonClass,
  storeHintClass,
  storeInputClass,
  storeLabelClass,
} from "./fields";

// Five thumb-sized choices in one row, so 360px fits them without wrapping.
// Used to write a review and to edit one; editing starts from what was saved.
export function ReviewForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: { rating: number; comment: string };
  submitLabel: string;
}) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);
  const errors = state.fieldErrors;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-4">
      <fieldset className="grid gap-2" {...invalidProps("rating", errors.rating)}>
        <legend className={`mb-2 ${storeLabelClass}`}>Stars</legend>
        <div className="grid grid-cols-5 gap-2">
          {ratings.map((n) => (
            <label
              key={n}
              className="flex min-h-12 cursor-pointer items-center justify-center gap-1 rounded-lg border bg-card text-base font-medium has-checked:border-primary has-checked:ring-1 has-checked:ring-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
            >
              <input
                type="radio"
                name="rating"
                value={n}
                defaultChecked={initial?.rating === n}
                aria-label={starsLabel(n)}
                className="sr-only"
              />
              <span aria-hidden>{n}</span>
              <span aria-hidden>★</span>
            </label>
          ))}
        </div>
        <p className={storeHintClass}>1 is poor, 5 is excellent.</p>
        <FieldError id="rating" errors={errors.rating} />
      </fieldset>

      <div className="grid gap-1">
        <label htmlFor="comment" className={storeLabelClass}>
          Comment <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={3}
          maxLength={500}
          defaultValue={initial?.comment}
          className={`${storeInputClass} h-auto py-2`}
          {...invalidProps("comment", errors.comment)}
        />
        <p className={storeHintClass}>Up to 500 characters. Shown on the store with your first name.</p>
        <FieldError id="comment" errors={errors.comment} />
      </div>

      <div className="grid gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {state.message && <FormMessage state={state} />}
      </div>
    </form>
  );
}
