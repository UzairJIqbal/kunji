"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "./form-parts";

// The way back to an order that has left the queue: a rejected one waiting on
// a refund, or a second look. The order page itself decides what's shown.
export function FindOrder() {
  const router = useRouter();
  const id = useId();
  const [error, setError] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const number = String(new FormData(event.currentTarget).get("number") ?? "")
      .trim()
      .replace(/^#/, "");
    if (!/^[1-9]\d{0,11}$/.test(number)) {
      setError("Type an order number");
      return;
    }
    setError("");
    router.push(`/admin/orders/${number}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-x-2 gap-y-1">
      <div>
        <label htmlFor={`${id}-number`} className={labelClass}>
          Order number
        </label>
        <input
          id={`${id}-number`}
          name="number"
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`mt-0.5 w-32 font-mono ${inputClass}`}
        />
      </div>
      <Button type="submit" variant="outline" size="sm">
        Open
      </Button>
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
