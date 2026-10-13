"use client";

import { useState } from "react";

// Copies a value so it can be pasted elsewhere without retyping: the account
// number into the wallet app, or an order's details into numastore. The label
// changes to say it worked; nothing else moves. Compact is the admin's size.
export function CopyButton({ value, what, compact = false }: { value: string; what: string; compact?: boolean }) {
  const [copied, setCopied] = useState<boolean | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex shrink-0 items-center rounded-md bg-secondary font-medium text-secondary-foreground hover:bg-secondary/70 focus-ring ${
        compact ? "h-6 px-1.5 text-xs" : "min-h-11 px-3 text-sm"
      }`}
    >
      {copied === null ? "Copy" : copied ? "Copied" : "Copy failed"}
      <span className="sr-only"> {what}</span>
      <span role="status" className="sr-only">
        {copied === true ? `${what} copied` : copied === false ? "Copy failed" : ""}
      </span>
    </button>
  );
}
