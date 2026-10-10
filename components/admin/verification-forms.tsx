"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { type FormState, type PaymentMethod, emptyFormState, paymentMethodLabel, paymentMethods } from "@/lib/catalogue";
import { OTHER_REASON, awayMessage, rejectReasons } from "@/lib/verification";
import { FieldError, FormMessage, inputClass, invalidProps, labelClass, useServerForm } from "./form-parts";

// Each order's controls are bound to its ID on the server; nothing the seller
// could change here says what the price or state is.

// One tap. On success the order leaves the queue, so only a refusal needs words.
export function ApproveButton({ action }: { action: (prev: FormState) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  return (
    <form action={formAction} className="inline-flex flex-wrap items-center gap-1.5">
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Approving…" : "Approve"}
      </Button>
      {state.message && !state.ok && (
        <span role="status" className="text-xs text-danger">
          {state.message}
        </span>
      )}
    </form>
  );
}

// Asks for the reason before anything is sent: the customer reads it.
export function RejectForm({ action }: { action: (prev: FormState, formData: FormData) => Promise<FormState> }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Reject
      </Button>
    );
  }
  return <RejectFields action={action} onCancel={() => setOpen(false)} />;
}

function RejectFields({
  action,
  onCancel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  onCancel: () => void;
}) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);
  const id = useId();
  const [reason, setReason] = useState("");
  const errors = state.fieldErrors;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="w-full rounded-md border p-2">
      <fieldset {...invalidProps(`${id}-reason`, errors.reason)}>
        <legend className={labelClass}>Why is it rejected?</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {[...rejectReasons, OTHER_REASON].map((value) => (
            <label
              key={value}
              className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs has-checked:border-foreground has-checked:font-medium"
            >
              <input
                type="radio"
                name="reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="size-3.5"
              />
              {value === OTHER_REASON ? "Other" : value}
            </label>
          ))}
        </div>
        <FieldError id={`${id}-reason`} errors={errors.reason} />
      </fieldset>
      {reason === OTHER_REASON && (
        <div className="mt-2">
          <label htmlFor={`${id}-other`} className={labelClass}>
            Reason the customer will read
          </label>
          <input
            id={`${id}-other`}
            name="otherReason"
            maxLength={200}
            autoFocus
            className={`mt-0.5 ${inputClass}`}
            {...invalidProps(`${id}-other`, errors.otherReason)}
          />
          <FieldError id={`${id}-other`} errors={errors.otherReason} />
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
          {pending ? "Rejecting…" : "Reject payment"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        {!state.ok && <FormMessage state={state} />}
      </div>
    </form>
  );
}

// The refund goes back to the number the customer paid from; the seller sends
// it by hand and records it here.
export function RefundForm({
  action,
  price,
  method,
  sentTo,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  price: number;
  method: PaymentMethod;
  sentTo: string;
}) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);
  const id = useId();
  const f = (name: string) => `${id}-${name}`;
  const errors = state.fieldErrors;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate>
      <p>
        Send it to <span className="font-mono">{sentTo}</span>, then record it.
      </p>
      <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div>
          <label htmlFor={f("amount")} className={labelClass}>
            Amount (Rs)
          </label>
          <input
            id={f("amount")}
            name="amount"
            defaultValue={price}
            inputMode="numeric"
            aria-required
            className={`mt-0.5 font-mono tabular-nums ${inputClass}`}
            {...invalidProps(f("amount"), errors.amount)}
          />
          <FieldError id={f("amount")} errors={errors.amount} />
        </div>
        <div>
          <label htmlFor={f("method")} className={labelClass}>
            Sent by
          </label>
          <select
            id={f("method")}
            name="method"
            defaultValue={method}
            className={`mt-0.5 ${inputClass}`}
            {...invalidProps(f("method"), errors.method)}
          >
            {paymentMethods.map((m) => (
              <option key={m} value={m}>
                {paymentMethodLabel[m]}
              </option>
            ))}
          </select>
          <FieldError id={f("method")} errors={errors.method} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor={f("reference")} className={labelClass}>
            Reference
          </label>
          <input
            id={f("reference")}
            name="reference"
            maxLength={64}
            aria-required
            className={`mt-0.5 font-mono ${inputClass}`}
            {...invalidProps(f("reference"), errors.reference)}
          />
          <FieldError id={f("reference")} errors={errors.reference} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Recording…" : "Record refund"}
        </Button>
        {!state.ok && <FormMessage state={state} />}
      </div>
    </form>
  );
}

// One switch for the whole store. While it's on, every storefront page says
// when orders will be delivered.
export function AwaySwitch({
  away,
  backAt,
  switchOn,
  switchOff,
}: {
  away: boolean;
  backAt: string | null;
  switchOn: (prev: FormState, formData: FormData) => Promise<FormState>;
  switchOff: (prev: FormState) => Promise<FormState>;
}) {
  if (away && backAt) return <AwayOn backAt={backAt} switchOff={switchOff} />;
  return <AwayOff backAt={backAt} switchOn={switchOn} />;
}

function AwayOn({ backAt, switchOff }: { backAt: string; switchOff: (prev: FormState) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(switchOff, emptyFormState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p>
        <span className="font-medium text-warning">Away is on.</span> Customers see &ldquo;{awayMessage(backAt)}&rdquo;.
      </p>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Switching off…" : "Switch off"}
      </Button>
      {!state.ok && <FormMessage state={state} />}
    </form>
  );
}

function AwayOff({
  backAt,
  switchOn,
}: {
  backAt: string | null;
  switchOn: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const { state, formAction, onSubmit, pending } = useServerForm(switchOn);
  const id = useId();
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-x-2 gap-y-1">
      <div>
        <label htmlFor={`${id}-back`} className={labelClass}>
          Back at
        </label>
        <input
          id={`${id}-back`}
          name="backAt"
          type="time"
          // A time input sends hh:mm; the database keeps seconds too.
          defaultValue={(backAt ?? "10:00").slice(0, 5)}
          aria-required
          className={`mt-0.5 w-32 ${inputClass}`}
          {...invalidProps(`${id}-back`, state.fieldErrors.backAt)}
        />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Switching on…" : "Switch away on"}
      </Button>
      <FieldError id={`${id}-back`} errors={state.fieldErrors.backAt} />
      {!state.ok && <FormMessage state={state} />}
    </form>
  );
}
