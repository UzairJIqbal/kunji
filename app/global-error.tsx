"use client";

import { useEffect } from "react";
import "./globals.css";

// Only shown if the root layout itself fails, so it can't rely on the header,
// fonts or theme script. It applies the saved theme itself and, like
// error.tsx, never prints the error.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    try {
      const t = localStorage.getItem("theme");
      if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    } catch {}
  }, []);

  return (
    <html lang="en">
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <title>Something failed · Kunji</title>
        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
          <p className="font-semibold">Kunji</p>
          <h1 className="heading-title mt-6">The store didn&apos;t load</h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Something on our side failed. Your orders and payments are unchanged. Try again in a
            moment.
          </p>
          {error.digest && (
            <p className="mt-3 text-sm text-muted-foreground">
              Reference <span className="font-mono">{error.digest}</span>
            </p>
          )}
          <button type="button" onClick={() => retry()} className="btn-primary mt-5 h-11 text-sm">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
