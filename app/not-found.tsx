import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found · Kunji" };

// A mistyped or old link. Nothing went wrong on the customer's side worth
// explaining; the useful thing is the way back to the products.
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <h1 className="heading-title">There&apos;s no page at this address</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">
        The link may be mistyped or out of date. Everything you can buy is on the store&apos;s
        front page, and your orders and logins are in your account.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link href="/" className="btn-primary h-11 text-sm">
          Browse the store
        </Link>
        <Link href="/account" className="text-link inline-flex min-h-11 items-center text-sm">
          Your account
        </Link>
      </div>
    </main>
  );
}
