"use client";

import { type FormEvent, useState } from "react";
import { invalidProps, useServerForm } from "@/components/admin/form-parts";
import { type FormState, type PaymentMethod, paymentMethodLabel } from "@/lib/catalogue";
import { MAX_RECEIPT_BYTES } from "@/lib/checkout";
import { CopyButton } from "./copy-button";
import {
  StoreFieldError as FieldError,
  StoreFormMessage as FormMessage,
  primaryButtonClass,
  storeHintClass,
  storeInputClass,
  storeLabelClass,
} from "./fields";

export type PayableAccount = {
  id: string;
  method: PaymentMethod;
  account_title: string;
  account_number: string;
  bank_name: string | null;
};

// Choose where you paid, see exactly what to send there, then prove it. The
// amount is the order's own price, read on the server; nothing here sets it.
export function PaymentForm({
  action,
  amount,
  accounts,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  amount: string;
  accounts: PayableAccount[];
}) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);
  const [chosenId, setChosenId] = useState(accounts.length === 1 ? accounts[0].id : "");
  // A file over the limit would be refused by the server anyway; saying so
  // here saves sending 10 MB over mobile data to hear it.
  const [tooBig, setTooBig] = useState(false);
  const chosen = accounts.find((account) => account.id === chosenId);
  const errors = state.fieldErrors;
  const receiptErrors = tooBig ? ["The screenshot is over 5 MB"] : errors.receipt;

  function submit(event: FormEvent<HTMLFormElement>) {
    const receipt = new FormData(event.currentTarget).get("receipt");
    if (receipt instanceof File && receipt.size > MAX_RECEIPT_BYTES) {
      event.preventDefault();
      setTooBig(true);
      return;
    }
    setTooBig(false);
    onSubmit(event);
  }

  return (
    <form action={formAction} onSubmit={submit} noValidate className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-base font-semibold">1. Choose where you&apos;ll pay</legend>
        {accounts.map((account) => (
          <label
            key={account.id}
            className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2 has-checked:border-primary has-checked:ring-1 has-checked:ring-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
          >
            <input
              type="radio"
              name="paymentAccountId"
              value={account.id}
              checked={account.id === chosenId}
              onChange={() => setChosenId(account.id)}
              className="size-5 shrink-0 accent-primary focus-visible:outline-none"
            />
            <span className="min-w-0">
              <span className="block font-medium">
                {account.bank_name ?? paymentMethodLabel[account.method]}
              </span>
              <span className="block truncate text-sm text-muted-foreground">
                {account.account_title}
              </span>
            </span>
          </label>
        ))}
        <FieldError id="paymentAccountId" errors={errors.paymentAccountId} />
      </fieldset>

      {chosen && (
        <section aria-labelledby="send-heading" className="rounded-lg border bg-card p-4">
          <h3 id="send-heading" className="text-base font-semibold">
            2. Send exactly
          </h3>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{amount}</p>
          <dl className="mt-3 grid gap-3">
            <div>
              <dt className={storeHintClass}>
                {paymentMethodLabel[chosen.method]}
                {chosen.bank_name ? `, ${chosen.bank_name}` : ""} account
              </dt>
              <dd className="mt-0.5 flex items-center justify-between gap-3">
                <span className="min-w-0 break-all text-xl font-semibold tabular-nums">
                  {chosen.account_number}
                </span>
                <CopyButton value={chosen.account_number} what="account number" />
              </dd>
            </div>
            <div>
              <dt className={storeHintClass}>Account title</dt>
              <dd className="font-medium">{chosen.account_title}</dd>
            </div>
          </dl>
        </section>
      )}

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-base font-semibold">3. Tell us you&apos;ve paid</legend>

        <div className="grid gap-1">
          <label htmlFor="transactionId" className={storeLabelClass}>
            Transaction ID
          </label>
          <input
            id="transactionId"
            name="transactionId"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={`${storeInputClass} font-mono`}
            {...invalidProps("transactionId", errors.transactionId)}
          />
          <p className={storeHintClass}>On the confirmation screen or SMS from your wallet.</p>
          <FieldError id="transactionId" errors={errors.transactionId} />
        </div>

        <div className="grid gap-1">
          <label htmlFor="senderNumber" className={storeLabelClass}>
            {chosen?.method === "bank_transfer"
              ? "Account number or IBAN you paid from"
              : "Number you paid from"}
          </label>
          <input
            id="senderNumber"
            name="senderNumber"
            type={chosen?.method === "bank_transfer" ? "text" : "tel"}
            inputMode={chosen?.method === "bank_transfer" ? "text" : "tel"}
            autoComplete="off"
            placeholder={chosen?.method === "bank_transfer" ? undefined : "0300 1234567"}
            className={storeInputClass}
            {...invalidProps("senderNumber", errors.senderNumber)}
          />
          <FieldError id="senderNumber" errors={errors.senderNumber} />
        </div>

        <div className="grid gap-1">
          <label htmlFor="receipt" className={storeLabelClass}>
            Screenshot of the payment
          </label>
          <input
            id="receipt"
            name="receipt"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={() => setTooBig(false)}
            className="block w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:bg-background file:px-3 file:text-sm file:font-medium file:text-primary"
            {...invalidProps("receipt", receiptErrors)}
          />
          <p className={storeHintClass}>JPEG, PNG or WebP, up to 5 MB. Only you and the seller can see it.</p>
          <FieldError id="receipt" errors={receiptErrors} />
        </div>
      </fieldset>

      <div className="grid gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Sending proof…" : "Send proof of payment"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
