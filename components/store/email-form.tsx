"use client";

import { invalidProps, useServerForm } from "@/components/admin/form-parts";
import type { FormState } from "@/lib/catalogue";
import {
  StoreFieldError as FieldError,
  StoreFormMessage as FormMessage,
  primaryButtonClass,
  storeInputClass,
  storeLabelClass,
} from "./fields";

export function EmailForm({
  action,
  current,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  current: string;
}) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);
  const errors = state.fieldErrors;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="grid gap-1">
        <label htmlFor="email" className={storeLabelClass}>
          Correct email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={current}
          className={storeInputClass}
          {...invalidProps("email", errors.email)}
        />
        <FieldError id="email" errors={errors.email} />
      </div>
      <div className="grid gap-1">
        <label htmlFor="emailAgain" className={storeLabelClass}>
          Same email again
        </label>
        <input
          id="emailAgain"
          name="emailAgain"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className={storeInputClass}
          {...invalidProps("emailAgain", errors.emailAgain)}
        />
        <FieldError id="emailAgain" errors={errors.emailAgain} />
      </div>
      <div className="grid gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : "Save email"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
