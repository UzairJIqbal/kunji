import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Warranty and refunds · Kunji",
  description: "What the warranty covers, for how long, what it doesn't, and how refunds are paid.",
};

// Each line here matches how orders, tickets and refunds actually work in the
// store. Change the policy and this page together, never one alone.

export default function WarrantyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="max-w-prose">
        <h1 className="heading-title">Warranty and refunds</h1>

        <h2 className="mt-6 heading-section">What&apos;s covered</h2>
        <p className="mt-1">
          If what you bought stops working while its warranty lasts, we get you a working
          replacement, or refund you if we can&apos;t.
        </p>

        <h2 className="mt-6 heading-section">For how long</h2>
        <p className="mt-1">
          Each plan shows its own warranty, and some plans have none. It counts from the moment
          your login arrives in your vault, not from when you paid. A replacement doesn&apos;t
          restart it: the warranty still runs from the first delivery.
        </p>

        <h2 className="mt-6 heading-section">What isn&apos;t covered</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            Anything the product&apos;s setup instructions say not to do. On a shared account
            that means changing its password, email, phone number or two-step verification.
          </li>
          <li>A problem that starts after the warranty has ended.</li>
          <li>A plan sold with no warranty.</li>
        </ul>

        <h2 className="mt-6 heading-section">Refunds</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            If we can&apos;t supply what you paid for, you get all of it back.
          </li>
          <li>If you sent the wrong amount, we send it back.</li>
          <li>
            If something stops working during its warranty and can&apos;t be replaced, we
            refund the part you haven&apos;t used. For example, a Rs 600 plan for 30 days
            with 15 days left is Rs 300.
          </li>
        </ul>

        <h2 className="mt-6 heading-section">How refunds are paid</h2>
        <p className="mt-1">
          To the wallet number you paid from, which you give us with your payment. We never ask
          for your PIN or a code to send a refund.
        </p>
      </div>
    </main>
  );
}
