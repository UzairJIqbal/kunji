"use client";

import { useState } from "react";

// Copies the account number so it can be pasted into the wallet app without
// retyping. The label changes to say it worked; nothing else moves.
export function CopyButton({ value, what }: { value: string; what: string }) {
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
      className="inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-sm font-medium text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {copied === null ? "Copy" : copied ? "Copied" : "Copy failed"}
      <span className="sr-only"> {what}</span>
      <span role="status" className="sr-only">
        {copied === true ? `${what} copied` : copied === false ? "Copy failed" : ""}
      </span>
    </button>
  );
}
