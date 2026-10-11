"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatWaiting, isOverdue, minutesWaiting, priceDifference } from "@/lib/buying";
import type { FormState } from "@/lib/catalogue";
import { FieldError, FormMessage, inputClass, invalidProps, labelClass, useServerForm } from "./form-parts";

// What the seller types after buying on numastore. The amount starts at the
// plan's listed supplier price; if numastore charged something else the
// seller corrects it and sees the difference as they type. The plan's price
// is theirs to change, on the plan, not here.
export function BoughtForm({
  action,
  listedPrice,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  listedPrice: number | null;
}) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);
  const id = useId();
  const f = (name: string) => `${id}-${name}`;
  const errors = state.fieldErrors;
  const [amount, setAmount] = useState(listedPrice === null ? "" : String(listedPrice));
  const difference =
    listedPrice !== null && /^\d{1,7}$/.test(amount.trim()) ? priceDifference(Number(amount.trim()), listedPrice) : null;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-wrap items-start gap-x-2 gap-y-1">
      <div className="w-44">
        <label htmlFor={f("number")} className={labelClass}>
          numastore order no.
        </label>
        <input
          id={f("number")}
          name="supplierOrderNumber"
          maxLength={64}
          autoComplete="off"
          aria-required
          className={`mt-0.5 font-mono ${inputClass}`}
          {...invalidProps(f("number"), errors.supplierOrderNumber)}
        />
        <FieldError id={f("number")} errors={errors.supplierOrderNumber} />
      </div>
      <div className="w-28">
        <label htmlFor={f("amount")} className={labelClass}>
          Paid (Rs)
        </label>
        <input
          id={f("amount")}
          name="amountPaid"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="numeric"
          autoComplete="off"
          aria-required
          aria-describedby={difference ? f("difference") : undefined}
          className={`mt-0.5 font-mono tabular-nums ${inputClass}`}
          {...invalidProps(f("amount"), errors.amountPaid)}
        />
        <FieldError id={f("amount")} errors={errors.amountPaid} />
      </div>
      <div className="flex min-h-8 flex-col justify-end self-stretch">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Bought"}
        </Button>
      </div>
      {difference && (
        <p id={f("difference")} className="w-full text-xs text-muted-foreground">
          {difference}. The plan keeps its price unless you change it.
        </p>
      )}
      {!state.ok && state.message && (
        <div className="w-full">
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}

// How long an order has waited since its payment was approved. Worked out
// from the approval's time each minute, never stored. Counts from whichever is
// later, the server's render or the last tick, so the first paint matches the
// server and a live refresh is never behind; amber once overdue.
export function WaitingClock({ paidAt, renderedAt }: { paidAt: string; renderedAt: string }) {
  const [tick, setTick] = useState<number | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const now = new Date(Math.max(new Date(renderedAt).getTime(), tick ?? 0));
  const minutes = minutesWaiting(paidAt, now);
  const overdue = isOverdue(minutes);
  return (
    <span className={`text-xs tabular-nums ${overdue ? "font-medium text-warning" : "text-muted-foreground"}`}>
      waiting {formatWaiting(minutes)}
      {overdue && <span className="sr-only">, overdue</span>}
    </span>
  );
}
