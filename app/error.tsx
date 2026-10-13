"use client";

import Link from "next/link";

// Shown when a page fails to load. The error itself is never printed: it may
// name a table or carry something from the request, and the customer can't act
// on it anyway. The digest is a reference the seller can find in the logs.
export default function PageError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <h1 className="heading-title">This page didn&apos;t load</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">
        Something on our side failed while loading it. Your orders and payments are unchanged. Try
        again, and if it keeps happening, message us on WhatsApp from the link below.
      </p>
      {error.digest && (
        <p className="mt-3 text-sm text-muted-foreground">
          Reference <span className="font-mono">{error.digest}</span>
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <button type="button" onClick={() => retry()} className="btn-primary h-11 text-sm">
          Try again
        </button>
        <Link href="/" className="text-link inline-flex min-h-11 items-center text-sm">
          Browse the store
        </Link>
      </div>
    </main>
  );
}
