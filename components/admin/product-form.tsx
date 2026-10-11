"use client";

import Image from "next/image";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  type AccountType,
  type FormState,
  accountTypeLabel,
  accountTypes,
} from "@/lib/catalogue";
import {
  FieldError,
  FormMessage,
  errorId,
  inputClass,
  invalidProps,
  labelClass,
  textareaClass,
  useServerForm,
} from "./form-parts";

export type ProductValues = {
  name: string;
  category: string;
  description: string;
  setupInstructions: string;
  warrantyWarning: string;
  accountType: AccountType | null;
  planNote: string;
  needsActivationEmail: boolean;
};

export const blankProduct: ProductValues = {
  name: "",
  category: "",
  description: "",
  setupInstructions: "",
  warrantyWarning: "",
  // No default: the seller has to say what the customer actually gets.
  accountType: null,
  planNote: "",
  needsActivationEmail: false,
};

export function ProductForm({
  action,
  initial,
  categories,
  imageUrl,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: ProductValues;
  categories: string[];
  imageUrl: string | null;
  submitLabel: string;
}) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);
  const id = useId();
  const f = (name: string) => `${id}-${name}`;
  const errors = state.fieldErrors;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={f("name")} className={labelClass}>
            Name
          </label>
          <input
            id={f("name")}
            name="name"
            defaultValue={initial.name}
            aria-required
            maxLength={120}
            className={`mt-0.5 ${inputClass}`}
            {...invalidProps(f("name"), errors.name)}
          />
          <FieldError id={f("name")} errors={errors.name} />
        </div>
        <div>
          <label htmlFor={f("category")} className={labelClass}>
            Category
          </label>
          <input
            id={f("category")}
            name="category"
            defaultValue={initial.category}
            list={f("categories")}
            aria-required
            maxLength={60}
            className={`mt-0.5 ${inputClass}`}
            {...invalidProps(f("category"), errors.category)}
          />
          <datalist id={f("categories")}>
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <FieldError id={f("category")} errors={errors.category} />
        </div>
      </div>

      <div>
        <label htmlFor={f("description")} className={labelClass}>
          Short description <span className="font-normal text-muted-foreground">optional, in your own words</span>
        </label>
        <textarea
          id={f("description")}
          name="description"
          defaultValue={initial.description}
          rows={3}
          maxLength={600}
          className={`mt-0.5 ${textareaClass}`}
          {...invalidProps(f("description"), errors.description)}
        />
        <FieldError id={f("description")} errors={errors.description} />
      </div>

      <div>
        <label htmlFor={f("setup")} className={labelClass}>
          Setup instructions <span className="font-normal text-muted-foreground">optional</span>
        </label>
        <textarea
          id={f("setup")}
          name="setupInstructions"
          defaultValue={initial.setupInstructions}
          rows={4}
          maxLength={4000}
          className={`mt-0.5 ${textareaClass}`}
          {...invalidProps(f("setup"), errors.setupInstructions)}
        />
        <FieldError id={f("setup")} errors={errors.setupInstructions} />
      </div>

      <div>
        <label htmlFor={f("warning")} className={labelClass}>
          What voids the warranty{" "}
          <span className="font-normal text-muted-foreground">
            optional, shown above the login in the customer&apos;s vault
          </span>
        </label>
        <textarea
          id={f("warning")}
          name="warrantyWarning"
          defaultValue={initial.warrantyWarning}
          rows={2}
          maxLength={1000}
          className={`mt-0.5 ${textareaClass}`}
          {...invalidProps(f("warning"), errors.warrantyWarning)}
        />
        <FieldError id={f("warning")} errors={errors.warrantyWarning} />
      </div>

      <fieldset
        role="radiogroup"
        aria-required
        {...(errors.accountType?.[0]
          ? { "aria-invalid": true, "aria-describedby": errorId(f("accountType")) }
          : {})}
      >
        <legend className={labelClass}>Account type</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {accountTypes.map((type) => (
            <label key={type} className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="accountType"
                value={type}
                defaultChecked={initial.accountType === type}
                className="size-3.5 accent-primary"
              />
              {accountTypeLabel[type]}
            </label>
          ))}
        </div>
        <FieldError id={f("accountType")} errors={errors.accountType} />
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={f("note")} className={labelClass}>
            Region or plan note <span className="font-normal text-muted-foreground">optional</span>
          </label>
          <input
            id={f("note")}
            name="planNote"
            defaultValue={initial.planNote}
            maxLength={300}
            className={`mt-0.5 ${inputClass}`}
            {...invalidProps(f("note"), errors.planNote)}
          />
          <FieldError id={f("note")} errors={errors.planNote} />
        </div>
        <label className="inline-flex items-center gap-1.5 self-end pb-1.5">
          <input
            type="checkbox"
            name="needsActivationEmail"
            defaultChecked={initial.needsActivationEmail}
            className="size-3.5 accent-primary"
          />
          Needs an activation email from the customer
        </label>
      </div>

      <div>
        <label htmlFor={f("image")} className={labelClass}>
          Image <span className="font-normal text-muted-foreground">JPEG, PNG or WebP, up to 1 MB</span>
        </label>
        <div className="mt-0.5 flex items-center gap-3">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt="Current product image"
              width={56}
              height={56}
              className="size-14 shrink-0 rounded-md border object-cover"
            />
          )}
          {/* Keyed by save count so a saved file isn't sent again on the next save. */}
          <input
            key={state.version}
            id={f("image")}
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="min-w-0 text-xs file:mr-2 file:rounded-md file:border file:border-input file:bg-background file:px-2 file:py-1 file:text-xs"
            {...invalidProps(f("image"), errors.image)}
          />
        </div>
        <FieldError id={f("image")} errors={errors.image} />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
