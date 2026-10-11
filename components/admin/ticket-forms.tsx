"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/catalogue";
import type { CredentialKind } from "@/lib/vault";
import { CredentialFields } from "./deliver-form";
import { FieldError, FormMessage, inputClass, invalidProps, labelClass, useServerForm } from "./form-parts";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

// The reference numastore gave the support ticket, so the claim can be
// followed up. The customer only learns a replacement is coming.
export function ClaimForm({ action }: { action: Action }) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);
  const id = `${useId()}-reference`;
  const errors = state.fieldErrors.reference;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-2">
      <div className="w-56">
        <label htmlFor={id} className={labelClass}>
          numastore ticket reference
        </label>
        <input
          id={id}
          name="reference"
          maxLength={64}
          aria-required
          autoComplete="off"
          spellCheck={false}
          className={`mt-0.5 font-mono ${inputClass}`}
          {...invalidProps(id, errors)}
        />
        <FieldError id={id} errors={errors} />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Mark claimed"}
      </Button>
      {!state.ok && state.message && <FormMessage state={state} />}
    </form>
  );
}

// What numastore sent in place of the old one. It goes into the same vault
// entry; the old one is kept, marked replaced, at no cost.
export function ReplaceFromClaimForm({ action, initialKind }: { action: Action; initialKind: CredentialKind }) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid max-w-md gap-2">
      <CredentialFields initialKind={initialKind} errors={state.fieldErrors} />
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Replacing…" : "Replace from the claim"}
        </Button>
      </div>
      {!state.ok && state.message && <FormMessage state={state} />}
    </form>
  );
}

// For when numastore refuses the claim: a fresh one, bought by hand, its
// order number and what it cost recorded against this order.
export function ReplaceByPurchaseForm({ action, initialKind }: { action: Action; initialKind: CredentialKind }) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);
  const id = useId();
  const f = (name: string) => `${id}-${name}`;
  const errors = state.fieldErrors;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid max-w-md gap-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={f("supplierOrderNumber")} className={labelClass}>
            New numastore order no.
          </label>
          <input
            id={f("supplierOrderNumber")}
            name="supplierOrderNumber"
            maxLength={64}
            aria-required
            autoComplete="off"
            spellCheck={false}
            className={`mt-0.5 font-mono ${inputClass}`}
            {...invalidProps(f("supplierOrderNumber"), errors.supplierOrderNumber)}
          />
          <FieldError id={f("supplierOrderNumber")} errors={errors.supplierOrderNumber} />
        </div>
        <div>
          <label htmlFor={f("cost")} className={labelClass}>
            It cost (Rs)
          </label>
          <input
            id={f("cost")}
            name="cost"
            inputMode="numeric"
            aria-required
            className={`mt-0.5 font-mono tabular-nums ${inputClass}`}
            {...invalidProps(f("cost"), errors.cost)}
          />
          <FieldError id={f("cost")} errors={errors.cost} />
        </div>
      </div>
      <CredentialFields initialKind={initialKind} errors={errors} />
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Replacing…" : "Replace with the new one"}
        </Button>
      </div>
      {!state.ok && state.message && <FormMessage state={state} />}
    </form>
  );
}
