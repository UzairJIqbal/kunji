import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HowItWorksSteps } from "@/components/store/how-it-works-steps";
import { paymentMethodLabel } from "@/lib/catalogue";
import { listAcceptedPaymentMethods } from "@/lib/data/storefront";

export const metadata: Metadata = {
  title: "How it works · Kunji",
  description: "From choosing a plan to finding your login in your vault, in four steps.",
};

const link =
  "text-link";

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="heading-title">How it works</h1>

      <HowItWorksSteps stepHeading="h2" />

      <section aria-labelledby="methods" className="mt-8">
        <h2 id="methods" className="heading-section">
          Ways to pay
        </h2>
        <Suspense fallback={<p className="mt-2 text-sm text-muted-foreground">Loading…</p>}>
          <PaymentMethods />
        </Suspense>
      </section>

      <section aria-labelledby="problems" className="mt-8 max-w-prose">
        <h2 id="problems" className="heading-section">
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
        <li key={method} className="rounded-md bg-card px-3 py-1.5 text-sm font-medium">
          {paymentMethodLabel[method]}
        </li>
      ))}
    </ul>
  );
}
