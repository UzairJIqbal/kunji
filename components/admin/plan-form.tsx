"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/catalogue";
import { formatRupees } from "@/lib/format";
import { isThinMargin, marginPercent, sellPrice } from "@/lib/pricing";
import {
  FieldError,
  FormMessage,
  inputClass,
  invalidProps,
  labelClass,
  useServerForm,
} from "./form-parts";

export type PlanValues = {
  durationDays: string;
  warrantyDays: string;
  supplierPrice: string;
  margin: string;
  numastoreUrl: string;
};

// The business plan's starting margin; the seller changes it per plan.
export const newPlanValues: PlanValues = {
  durationDays: "",
  warrantyDays: "",
  supplierPrice: "",
  margin: "150",
  numastoreUrl: "",
};

export function PlanForm({
  action,
  initial,
  submitLabel,
  clearOnSave = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: PlanValues;
  submitLabel: string;
  clearOnSave?: boolean;
}) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate>
      {/* A new key after each save starts the add-plan fields over. */}
      <PlanFields key={clearOnSave ? state.version : 0} initial={initial} state={state} />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function wholeRupees(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

function PlanFields({ initial, state }: { initial: PlanValues; state: FormState }) {
  const id = useId();
  const f = (name: string) => `${id}-${name}`;
  const errors = state.fieldErrors;

  // Only these two are held in state: the sell price and margin percentage are
  // worked out from them as the seller types. The server ignores both results
  // and the database works the sell price out again on save.
  const [supplierPrice, setSupplierPrice] = useState(initial.supplierPrice);
  const [margin, setMargin] = useState(initial.margin);
  const supplier = wholeRupees(supplierPrice);
  const marginRupees = wholeRupees(margin);
  const priced = supplier !== null && supplier > 0 && marginRupees !== null;

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label htmlFor={f("duration")} className={labelClass}>
            Duration, days
          </label>
          <input
            id={f("duration")}
            name="durationDays"
            defaultValue={initial.durationDays}
            inputMode="numeric"
            aria-required
            className={`mt-0.5 font-mono tabular-nums ${inputClass}`}
            {...invalidProps(f("duration"), errors.durationDays)}
          />
          <FieldError id={f("duration")} errors={errors.durationDays} />
        </div>
        <div>
          <label htmlFor={f("warranty")} className={labelClass}>
            Warranty, days <span className="font-normal text-muted-foreground">0 for none</span>
          </label>
          <input
            id={f("warranty")}
            name="warrantyDays"
            defaultValue={initial.warrantyDays}
            inputMode="numeric"
            aria-required
            className={`mt-0.5 font-mono tabular-nums ${inputClass}`}
            {...invalidProps(f("warranty"), errors.warrantyDays)}
          />
          <FieldError id={f("warranty")} errors={errors.warrantyDays} />
        </div>
        <div>
          <label htmlFor={f("supplier")} className={labelClass}>
            Numastore price, Rs
          </label>
          <input
            id={f("supplier")}
            name="supplierPrice"
            value={supplierPrice}
            onChange={(event) => setSupplierPrice(event.target.value)}
            inputMode="numeric"
            aria-required
            className={`mt-0.5 font-mono tabular-nums ${inputClass}`}
            {...invalidProps(f("supplier"), errors.supplierPrice)}
          />
          <FieldError id={f("supplier")} errors={errors.supplierPrice} />
        </div>
        <div>
          <label htmlFor={f("margin")} className={labelClass}>
            Margin, Rs
          </label>
          <input
            id={f("margin")}
            name="margin"
            value={margin}
            onChange={(event) => setMargin(event.target.value)}
            inputMode="numeric"
            aria-required
            className={`mt-0.5 font-mono tabular-nums ${inputClass}`}
            {...invalidProps(f("margin"), errors.margin)}
          />
          <FieldError id={f("margin")} errors={errors.margin} />
        </div>
      </div>

      <div>
        <label htmlFor={f("url")} className={labelClass}>
          Link to this item on numastore
        </label>
        <input
          id={f("url")}
          name="numastoreUrl"
          defaultValue={initial.numastoreUrl}
          type="url"
          inputMode="url"
          aria-required
          placeholder="https://numastore.pro/…"
          className={`mt-0.5 font-mono ${inputClass}`}
          {...invalidProps(f("url"), errors.numastoreUrl)}
        />
        <FieldError id={f("url")} errors={errors.numastoreUrl} />
      </div>

      <output aria-live="polite" className="flex flex-wrap gap-x-4 tabular-nums">
        {priced ? (
          <>
            <span>
              Sells at <span className="font-semibold">{formatRupees(sellPrice(supplier, marginRupees))}</span>
            </span>
            {isThinMargin(supplier, marginRupees) ? (
              <span className="font-medium text-warning">
                {marginPercent(supplier, marginRupees)}% margin, under 10%
              </span>
            ) : (
              <span>{marginPercent(supplier, marginRupees)}% margin</span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">
            Sell price appears once the numastore price and margin are whole rupees.
          </span>
        )}
      </output>
    </div>
  );
}
