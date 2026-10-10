import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/store/checkout-form";
import { storeHintClass, textLinkClass } from "@/components/store/fields";
import { accountTypeLabel } from "@/lib/catalogue";
import { formatMobile } from "@/lib/checkout";
import { getCheckout } from "@/lib/data/checkout";
import { formatDays, formatRupees, formatWarranty } from "@/lib/format";
import { DELIVERY_SENTENCE } from "@/lib/storefront";

export const metadata: Metadata = { title: "Checkout · Kunji" };

// The proxy sends a signed-out visitor to sign in and back here, to the same
// plan. One screen: what you're buying, restated, and the few things asked.
export default function CheckoutPage({ params }: PageProps<"/checkout/[planId]">) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Checkout params={params} />
      </Suspense>
    </main>
  );
}

async function Checkout({ params }: Pick<PageProps<"/checkout/[planId]">, "params">) {
  const checkout = await getCheckout((await params).planId);
  if (!checkout) notFound();
  const { plan, product, savedWhatsapp } = checkout;

  const facts = [
    { term: "You get", detail: accountTypeLabel[product.account_type] },
    { term: "Duration", detail: formatDays(plan.duration_days) },
    { term: "Warranty", detail: formatWarranty(plan.warranty_days) },
  ];

  return (
    <>
      <Link href={`/products/${product.slug}`} className={`${textLinkClass} text-sm`}>
        Back to {product.name}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Checkout</h1>

      <section aria-label="Your order" className="mt-4 rounded-lg border bg-card p-4">
        <p className="text-lg font-semibold leading-snug">{product.name}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {facts.map(({ term, detail }) => (
            <div key={term} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{term}</dt>
              <dd className="font-medium">{detail}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t pt-3">
          <span className="text-sm text-muted-foreground">Price</span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatRupees(plan.sell_price)}
          </span>
        </div>
      </section>

      <div className="mt-6">
        {product.sold_out ? (
          <p className="rounded-lg border px-4 py-6 text-center">
            Sold out for now. This plan can&apos;t be ordered until it&apos;s back in stock.
          </p>
        ) : (
          <>
            <CheckoutForm
              planId={plan.id}
              askEmail={product.needs_activation_email}
              savedWhatsapp={savedWhatsapp && formatMobile(savedWhatsapp)}
            />
            <p className={`mt-4 ${storeHintClass}`}>
              You pay on the next screen, from your wallet or bank. The order waits two
              hours for payment. {DELIVERY_SENTENCE}
            </p>
          </>
        )}
      </div>
    </>
  );
}
