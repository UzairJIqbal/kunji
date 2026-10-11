"use client";

import { useState, useTransition } from "react";
import { CopyButton } from "@/components/store/copy-button";
import { primaryButtonClass } from "@/components/store/fields";
import type { RevealResult } from "@/lib/actions/vault";
import type { Credential } from "@/lib/vault";

// Hidden until tapped. Each tap asks the server, which records the reveal
// before it decrypts, so every look is on the record; nothing is fetched
// ahead or kept after Hide. Compact is the admin's size.
export function RevealCredential({
  reveal,
  compact = false,
}: {
  reveal: () => Promise<RevealResult>;
  compact?: boolean;
}) {
  const [credential, setCredential] = useState<Credential | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function show() {
    startTransition(async () => {
      const result = await reveal();
      if (result.ok) {
        setCredential(result.credential);
        setMessage(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  const buttonClass = compact
    ? "inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
    : primaryButtonClass;

  if (!credential) {
    return (
      <div>
        <button type="button" onClick={show} disabled={pending} className={buttonClass}>
          {pending ? "Opening…" : compact ? "Reveal credential" : "Show login details"}
        </button>
        {!compact && !pending && (
          <p className="mt-2 text-sm text-muted-foreground">Each time it&apos;s shown is recorded.</p>
        )}
        {message && (
          <p role="status" className={`mt-2 text-danger ${compact ? "text-xs" : "text-sm"}`}>
            {message}
          </p>
        )}
      </div>
    );
  }

  const fields =
    credential.kind === "login"
      ? [
          { label: "Login", value: credential.login, mono: true },
          { label: "Password", value: credential.password, mono: true },
        ]
      : credential.kind === "licence_key"
        ? [{ label: "Licence key", value: credential.key, mono: true }]
        : [{ label: "Invite", value: credential.note, mono: false }];

  return (
    <div>
      <dl className={compact ? "grid gap-1" : "grid gap-3"}>
        {fields.map(({ label, value, mono }) => (
          <div key={label}>
            <dt className={compact ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>{label}</dt>
            <dd className="mt-0.5 flex items-start justify-between gap-2">
              <span
                className={`min-w-0 break-all whitespace-pre-wrap select-all ${mono ? "font-mono" : ""} ${
                  compact ? "text-[13px]" : "text-base"
                }`}
              >
                {value}
              </span>
              <CopyButton value={value} what={label} compact={compact} />
            </dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={() => setCredential(null)}
        className={
          compact
            ? "mt-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
            : "mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        }
      >
        Hide
      </button>
    </div>
  );
}
