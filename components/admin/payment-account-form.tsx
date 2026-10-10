"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type FormState,
  type PaymentMethod,
  paymentMethodLabel,
  paymentMethods,
} from "@/lib/catalogue";
import {
  FieldError,
  FormMessage,
  inputClass,
  invalidProps,
  labelClass,
  useServerForm,
} from "./form-parts";

export type PaymentAccountValues = {
  method: PaymentMethod;
  accountTitle: string;
  accountNumber: string;
  bankName: string;
};

export const blankPaymentAccount: PaymentAccountValues = {
  method: "easypaisa",
  accountTitle: "",
  accountNumber: "",
  bankName: "",
};

export function PaymentAccountForm({
  action,
  initial,
  submitLabel,
  clearOnSave = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: PaymentAccountValues;
  submitLabel: string;
  clearOnSave?: boolean;
}) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate>
      <AccountFields key={clearOnSave ? state.version : 0} initial={initial} state={state} />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function AccountFields({
  initial,
  state,
}: {
  initial: PaymentAccountValues;
  state: FormState;
}) {
  const id = useId();
  const f = (name: string) => `${id}-${name}`;
  const errors = state.fieldErrors;
  // Held so the bank name field appears only for a bank transfer.
  const [method, setMethod] = useState<string>(initial.method);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div>
        <label htmlFor={f("method")} className={labelClass}>
          Method
        </label>
        <select
          id={f("method")}
          name="method"
          value={method}
          onChange={(event) => setMethod(event.target.value)}
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
      {method === "bank_transfer" && (
        <div>
          <label htmlFor={f("bank")} className={labelClass}>
            Bank name
          </label>
          <input
            id={f("bank")}
            name="bankName"
            defaultValue={initial.bankName}
            aria-required
            maxLength={80}
            className={`mt-0.5 ${inputClass}`}
            {...invalidProps(f("bank"), errors.bankName)}
          />
          <FieldError id={f("bank")} errors={errors.bankName} />
        </div>
      )}
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor={f("title")} className={labelClass}>
          Account title
        </label>
        <input
          id={f("title")}
          name="accountTitle"
          defaultValue={initial.accountTitle}
          aria-required
          maxLength={100}
          className={`mt-0.5 ${inputClass}`}
          {...invalidProps(f("title"), errors.accountTitle)}
        />
        <FieldError id={f("title")} errors={errors.accountTitle} />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor={f("number")} className={labelClass}>
          Account number
        </label>
        <input
          id={f("number")}
          name="accountNumber"
          defaultValue={initial.accountNumber}
          inputMode={method === "bank_transfer" ? "text" : "numeric"}
          aria-required
          maxLength={40}
          className={`mt-0.5 font-mono ${inputClass}`}
          {...invalidProps(f("number"), errors.accountNumber)}
        />
        <FieldError id={f("number")} errors={errors.accountNumber} />
      </div>
    </div>
  );
}
