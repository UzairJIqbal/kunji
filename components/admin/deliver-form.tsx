"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AccountType, FormState } from "@/lib/catalogue";
import { type CredentialKind, credentialKindLabel, credentialKinds } from "@/lib/vault";
import { FieldError, FormMessage, inputClass, invalidProps, labelClass, textareaClass, useServerForm } from "./form-parts";

// Off for every credential field: no autofill offering the seller's own
// logins, no spellcheck sending what's typed to a dictionary service, and no
// password manager offering to save the customer's password as the seller's.
const secretProps = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  "data-1p-ignore": true,
  "data-lpignore": "true",
} as const;

// What numastore delivered, pasted in. Only the chosen kind's fields are on
// the page, so only they are sent. The kind starts from the product: an
// email-invite product starts at invite, everything else at login.
export function DeliverForm({
  action,
  accountType,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  accountType: AccountType;
}) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid max-w-md gap-2">
      <CredentialFields initialKind={accountType === "email_invite" ? "invite" : "login"} errors={state.fieldErrors} />
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Delivering…" : "Deliver to vault"}
        </Button>
      </div>
      {!state.ok && state.message && <FormMessage state={state} />}
    </form>
  );
}

// The credential's own fields, shared by delivering and replacing so a
// replacement is pasted exactly as the first one was.
export function CredentialFields({
  initialKind,
  errors,
}: {
  initialKind: CredentialKind;
  errors: FormState["fieldErrors"];
}) {
  const id = useId();
  const f = (name: string) => `${id}-${name}`;
  const [kind, setKind] = useState<CredentialKind>(initialKind);

  return (
    <>
      <fieldset>
        <legend className={labelClass}>What numastore delivered</legend>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
          {credentialKinds.map((option) => (
            <label key={option} className="flex items-center gap-1.5 text-[13px]">
              <input
                type="radio"
                name="kind"
                value={option}
                checked={kind === option}
                onChange={() => setKind(option)}
                className="accent-primary"
              />
              {credentialKindLabel[option]}
            </label>
          ))}
        </div>
      </fieldset>

      {kind === "login" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor={f("login")} className={labelClass}>
              Login
            </label>
            <input
              id={f("login")}
              name="login"
              maxLength={254}
              aria-required
              className={`mt-0.5 font-mono ${inputClass}`}
              {...secretProps}
              {...invalidProps(f("login"), errors.login)}
            />
            <FieldError id={f("login")} errors={errors.login} />
          </div>
          <div>
            <label htmlFor={f("password")} className={labelClass}>
              Password
            </label>
            <input
              id={f("password")}
              name="password"
              maxLength={256}
              aria-required
              className={`mt-0.5 font-mono ${inputClass}`}
              {...secretProps}
              {...invalidProps(f("password"), errors.password)}
            />
            <FieldError id={f("password")} errors={errors.password} />
          </div>
        </div>
      )}

      {kind === "licence_key" && (
        <div>
          <label htmlFor={f("key")} className={labelClass}>
            Licence key
          </label>
          <textarea
            id={f("key")}
            name="key"
            rows={2}
            maxLength={1000}
            aria-required
            className={`mt-0.5 font-mono ${textareaClass}`}
            {...secretProps}
            {...invalidProps(f("key"), errors.key)}
          />
          <FieldError id={f("key")} errors={errors.key} />
        </div>
      )}

      {kind === "invite" && (
        <div>
          <label htmlFor={f("note")} className={labelClass}>
            Invite note <span className="font-normal text-muted-foreground">what the customer should do with it</span>
          </label>
          <textarea
            id={f("note")}
            name="note"
            rows={3}
            maxLength={2000}
            aria-required
            className={`mt-0.5 ${textareaClass}`}
            {...secretProps}
            {...invalidProps(f("note"), errors.note)}
          />
          <FieldError id={f("note")} errors={errors.note} />
        </div>
      )}

    </>
  );
}
