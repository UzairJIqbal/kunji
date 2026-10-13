"use client";

import { useId } from "react";
import { FieldError, FormMessage, invalidProps, textareaClass, useServerForm } from "@/components/admin/form-parts";
import {
  StoreFieldError,
  StoreFormMessage,
  primaryButtonClass,
  storeInputClass,
  storeLabelClass,
} from "@/components/store/fields";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/catalogue";
import { formatPakistanTime } from "@/lib/format";

export type ThreadMessage = { id: number; body: string; from_seller: boolean; created_at: string };

// One thread, read the same way by both sides; only the names change. The
// customer's side is sized for a phone, the seller's is dense.
export function TicketThread({
  messages,
  viewer,
}: {
  messages: ThreadMessage[];
  viewer: "customer" | "seller";
}) {
  if (messages.length === 0) return null;
  const dense = viewer === "seller";
  const who = (fromSeller: boolean) =>
    fromSeller ? (dense ? "You" : "Kunji") : dense ? "Customer" : "You";

  return (
    <ol className={`grid ${dense ? "gap-1.5" : "gap-3"}`}>
      {messages.map((message) => {
        const mine = message.from_seller === dense;
        return (
          <li
            key={message.id}
            className={`rounded-lg ${dense ? "px-2 py-1" : "px-3 py-2"} ${mine ? "ml-6 bg-secondary" : "mr-6 bg-raised"}`}
          >
            <p className={`${dense ? "text-xs" : "text-sm"} text-muted-foreground`}>
              <span className="font-medium text-foreground">{who(message.from_seller)}</span>,{" "}
              {formatPakistanTime(message.created_at)}
            </p>
            <p className={`whitespace-pre-line break-words ${dense ? "" : "text-base"}`}>{message.body}</p>
          </li>
        );
      })}
    </ol>
  );
}

// The box empties only once the message is saved: it's keyed by the form's
// version, which moves on a save and stays put on a refusal.
export function MessageForm({
  action,
  viewer,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  viewer: "customer" | "seller";
}) {
  const { state, formAction, onSubmit, pending } = useServerForm(action);
  const id = `${useId()}-body`;
  const errors = state.fieldErrors.body;

  if (viewer === "seller") {
    return (
      <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-1">
        <label htmlFor={id} className="sr-only">
          Reply to the customer
        </label>
        <textarea
          key={state.version}
          id={id}
          name="body"
          rows={2}
          maxLength={2000}
          placeholder="Reply to the customer"
          className={textareaClass}
          {...invalidProps(id, errors)}
        />
        <FieldError id={id} errors={errors} />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Sending…" : "Send reply"}
          </Button>
          {!state.ok && state.message && <FormMessage state={state} />}
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-2">
      <label htmlFor={id} className={storeLabelClass}>
        Add a message
      </label>
      <textarea
        key={state.version}
        id={id}
        name="body"
        rows={3}
        maxLength={2000}
        className={`${storeInputClass} h-auto py-2`}
        {...invalidProps(id, errors)}
      />
      <StoreFieldError id={id} errors={errors} />
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Sending…" : "Send message"}
      </button>
      {!state.ok && state.message && <StoreFormMessage state={state} />}
    </form>
  );
}
