"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/admin/form-parts";
import { Button } from "@/components/ui/button";
import { sendTestAlert } from "@/lib/actions/seller-alerts";
import { emptyFormState } from "@/lib/catalogue";

// Unlike a switch, the answer is the point here: how each channel went.
export function TestAlertButton() {
  const [state, formAction, pending] = useActionState(sendTestAlert, emptyFormState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <Button type="submit" variant="outline" size="xs" disabled={pending}>
        {pending ? "Sending…" : "Send a test"}
      </Button>
      {state.message && <FormMessage state={state} />}
    </form>
  );
}
