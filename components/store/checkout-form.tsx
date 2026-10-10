"use client";

import { invalidProps, useServerForm } from "@/components/admin/form-parts";
import { placeOrder } from "@/lib/actions/checkout";
import {
  StoreFieldError as FieldError,
  StoreFormMessage as FormMessage,
  primaryButtonClass,
  storeHintClass,
  storeInputClass,
  storeLabelClass,
} from "./fields";

// The plan is the only thing about the order the browser sends; the price
// shown above the button is for reading, and the database sets its own.
export function CheckoutForm({
  planId,
  askEmail,
  savedWhatsapp,
}: {
  planId: string;
  askEmail: boolean;
  savedWhatsapp: string | null;
}) {
  const { state, formAction, onSubmit, pending } = useServerForm(placeOrder);
  const errors = state.fieldErrors;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-4">
      <input type="hidden" name="planId" value={planId} />

      {askEmail && (
        <fieldset className="grid gap-3">
          <legend className="text-base font-semibold">Email to activate it on</legend>
          <p className={storeHintClass}>
            The subscription is switched on for this email. Type it twice so a typo
            can&apos;t activate someone else&apos;s account.
          </p>
          <div className="grid gap-1">
            <label htmlFor="email" className={storeLabelClass}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
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
        </fieldset>
      )}

      {savedWhatsapp ? (
        <p className={storeHintClass}>
          We&apos;ll message you about this order on WhatsApp at{" "}
          <span className="font-medium text-foreground tabular-nums">{savedWhatsapp}</span>.
        </p>
      ) : (
        <div className="grid gap-1">
          <label htmlFor="whatsapp" className={storeLabelClass}>
            Your WhatsApp number
          </label>
          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0300 1234567"
            className={storeInputClass}
            {...invalidProps("whatsapp", errors.whatsapp)}
          />
          <p className={storeHintClass}>Asked once, for messages about your orders.</p>
          <FieldError id="whatsapp" errors={errors.whatsapp} />
        </div>
      )}

      <div className="grid gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Placing order…" : "Place order"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
