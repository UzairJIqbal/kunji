"use client";

import { type FormEvent, useState } from "react";
import { invalidProps, useServerForm } from "@/components/admin/form-parts";
import type { FormState } from "@/lib/catalogue";
import { MAX_SCREENSHOT_BYTES, ticketReasonLabel, ticketReasons } from "@/lib/warranty";
import {
  StoreFieldError as FieldError,
  StoreFormMessage as FormMessage,
  primaryButtonClass,
  storeHintClass,
  storeInputClass,
  storeLabelClass,
} from "./fields";

// What's wrong, in the customer's words, and a screenshot if they have one.
// On success the action goes back to the order, where the thread is.
export function TicketForm({ action }: { action: (prev: FormState, formData: FormData) => Promise<FormState> }) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);
  // Said here so a large photo isn't sent over mobile data to be refused.
  const [tooBig, setTooBig] = useState(false);
  const errors = state.fieldErrors;
  const screenshotErrors = tooBig ? ["The screenshot is over 5 MB"] : errors.screenshot;

  function submit(event: FormEvent<HTMLFormElement>) {
    const screenshot = new FormData(event.currentTarget).get("screenshot");
    if (screenshot instanceof File && screenshot.size > MAX_SCREENSHOT_BYTES) {
      event.preventDefault();
      setTooBig(true);
      return;
    }
    setTooBig(false);
    onSubmit(event);
  }

  return (
    <form action={formAction} onSubmit={submit} noValidate className="grid gap-5">
      <fieldset className="grid gap-2" {...invalidProps("reason", errors.reason)}>
        <legend className="mb-2 heading-section">What&apos;s wrong?</legend>
        {ticketReasons.map((reason) => (
          <label
            key={reason}
            className="flex min-h-12 cursor-pointer items-center gap-3 surface px-3 has-checked:bg-raised has-checked:ring-2 has-checked:ring-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
          >
            <input
              type="radio"
              name="reason"
              value={reason}
              className="size-5 shrink-0 accent-primary focus-visible:outline-none"
            />
            <span className="font-medium">{ticketReasonLabel[reason]}</span>
          </label>
        ))}
        <FieldError id="reason" errors={errors.reason} />
      </fieldset>

      <div className="grid gap-1">
        <label htmlFor="note" className={storeLabelClass}>
          Tell us more
        </label>
        <textarea
          id="note"
          name="note"
          rows={4}
          maxLength={2000}
          className={`${storeInputClass} h-auto py-2`}
          {...invalidProps("note", errors.note)}
        />
        <p className={storeHintClass}>What you see when you try it. Needed if you chose something else.</p>
        <FieldError id="note" errors={errors.note} />
      </div>

      <div className="grid gap-1">
        <label htmlFor="screenshot" className={storeLabelClass}>
          Screenshot <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id="screenshot"
          name="screenshot"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={() => setTooBig(false)}
          className="block w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:text-sm file:font-medium file:text-secondary-foreground"
          {...invalidProps("screenshot", screenshotErrors)}
        />
        <p className={storeHintClass}>JPEG, PNG or WebP, up to 5 MB. Only you and the seller can see it.</p>
        <FieldError id="screenshot" errors={screenshotErrors} />
      </div>

      <div className="grid gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Sending…" : "Report the problem"}
        </button>
        {!state.ok && state.message && <FormMessage state={state} />}
      </div>
    </form>
  );
}
