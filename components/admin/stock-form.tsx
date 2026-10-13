"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { type FormState, emptyFormState } from "@/lib/catalogue";
import { MAX_STOCK_LINES, STOCK_FORMAT } from "@/lib/stock";
import { secretProps } from "./deliver-form";
import { FieldError, FormMessage, errorId, labelClass, textareaClass, useServerForm } from "./form-parts";

// Logins bought ahead on numastore, pasted one per line. The box is emptied
// once anything goes in, so a second tap can't send the same lines again;
// a paste refused whole stays put to be fixed.
export function StockForm({ action }: { action: (prev: FormState, formData: FormData) => Promise<FormState> }) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);
  const id = useId();
  const field = `${id}-lines`;
  const hint = `${id}-hint`;
  const refused = Boolean(state.fieldErrors.lines?.[0]);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-2">
      <div>
        <label htmlFor={field} className={labelClass}>
          Logins, one per line
        </label>
        <p id={hint} className="text-xs text-muted-foreground">
          <span className="font-mono">{STOCK_FORMAT}</span>. The date is the day it stops working. Up to{" "}
          {MAX_STOCK_LINES} at a time.
        </p>
        <textarea
          key={state.version}
          id={field}
          name="lines"
          rows={6}
          wrap="off"
          className={`${textareaClass} mt-1 font-mono`}
          aria-describedby={refused ? `${hint} ${errorId(field)}` : hint}
          aria-invalid={refused || undefined}
          {...secretProps}
        />
        <FieldError id={field} errors={state.fieldErrors.lines} />
      </div>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add to stock"}
        </Button>
      </div>
      {state.message && <FormMessage state={state} />}
    </form>
  );
}

// Asks once: the login was paid for, and once removed it's gone from Kunji.
export function RemoveStockButton({ action }: { action: (prev: FormState) => Promise<FormState> }) {
  const [asking, setAsking] = useState(false);
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  if (!asking) {
    return (
      <Button type="button" variant="outline" size="xs" onClick={() => setAsking(true)}>
        Remove
      </Button>
    );
  }
  return (
    <form action={formAction} className="inline-flex flex-wrap items-center gap-1.5">
      <Button type="submit" variant="destructive" size="xs" disabled={pending}>
        {pending ? "Removing…" : "Yes, remove"}
      </Button>
      <Button type="button" variant="ghost" size="xs" disabled={pending} onClick={() => setAsking(false)}>
        Keep
      </Button>
      {state.message && !state.ok && (
        <span role="status" className="text-xs text-danger">
          {state.message}
        </span>
      )}
    </form>
  );
}
