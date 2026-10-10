"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { type FormState, emptyFormState } from "@/lib/catalogue";

// One tap, one change. On success the page itself shows the new state; only a
// refusal needs words.
export function ActionButton({
  action,
  label,
  pendingLabel,
}: {
  action: (prev: FormState) => Promise<FormState>;
  label: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  return (
    <form action={formAction} className="inline-flex items-center gap-1.5">
      <Button type="submit" variant="outline" size="xs" disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {state.message && !state.ok && (
        <span role="status" className="text-xs text-danger">
          {state.message}
        </span>
      )}
    </form>
  );
}
