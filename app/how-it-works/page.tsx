import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { paymentMethodLabel } from "@/lib/catalogue";
import { listAcceptedPaymentMethods } from "@/lib/data/storefront";
import { DELIVERY_SENTENCE } from "@/lib/storefront";

export const metadata: Metadata = {
  title: "How it works · Kunji",
  description: "From choosing a plan to finding your login in your vault, in four steps.",
};

const link =
  "rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// A real sequence, so it's numbered. Every step here is something the store
// actually does; nothing is promised that the order page can't show.
const steps = [
  {
    title: "Choose a plan",
    body: "Every product page says exactly what you get: your own account, a shared slot, or an invite to your email, with its duration and warranty.",
  },
  {
    title: "Pay from your wallet",
    body: "Send the exact amount to the account shown at checkout. Then enter the transaction ID and the number you paid from, and upload the receipt.",
  },
  {
    title: "We check your payment",
    body: "A person checks the money has arrived before your order counts as paid. A screenshot alone never does it. Your order page shows where it's up to.",
  },
  {
    title: "Open your vault",
    body: `${DELIVERY_SENTENCE} Your login is kept there, encrypted, with setup instructions and the date it runs out.`,
  },
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">How it works</h1>

      <ol className="mt-5 grid gap-4">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums"
            >
              {i + 1}
            </span>
            <div className="max-w-prose">
              <h2 className="font-semibold">{step.title}</h2>
              <p className="mt-0.5 text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section aria-labelledby="methods" className="mt-8">
        <h2 id="methods" className="text-lg font-semibold">
          Ways to pay
        </h2>
        <Suspense fallback={<p className="mt-2 text-sm text-muted-foreground">Loading…</p>}>
          <PaymentMethods />
        </Suspense>
      </section>

      <section aria-labelledby="problems" className="mt-8 max-w-prose">
        <h2 id="problems" className="text-lg font-semibold">
          If something goes wrong
        </h2>
        <dl className="mt-2 grid gap-3">
          <div>
            <dt className="font-medium">We can&apos;t find your payment</dt>
            <dd className="text-muted-foreground">
              Your order page tells you why. If the money turns up later, we approve it then. If
              the wrong amount arrived, we send it back to the number you paid from.
            </dd>
          </div>
          <div>
            <dt className="font-medium">It&apos;s out of stock after you paid</dt>
            <dd className="text-muted-foreground">
              You get all your money back, sent to the number you paid from.
            </dd>
          </div>
          <div>
            <dt className="font-medium">It stops working</dt>
            <dd className="text-muted-foreground">
              While the plan&apos;s warranty lasts, we replace it or refund the part you
              haven&apos;t used. Message us on WhatsApp with your order number.{" "}
              <Link href="/warranty" className={link}>
                Warranty and refunds
              </Link>
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

async function PaymentMethods() {
  const methods = await listAcceptedPaymentMethods();
  if (methods.length === 0) {
    return (
      <p className="mt-2 text-muted-foreground">
        No payment methods are open right now. Message us on WhatsApp before you order.
      </p>
    );
  }
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {methods.map((method) => (
        <li key={method} className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium">
          {paymentMethodLabel[method]}
        </li>
      ))}
    </ul>
  );
}
