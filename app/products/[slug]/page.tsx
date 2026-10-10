import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HonestFacts, Price, ProductBadges, ProductImage } from "@/components/store/product-parts";
import { accountTypeLabel } from "@/lib/catalogue";
import { getProduct } from "@/lib/data/storefront";
import { formatDays, formatRupees, formatWarranty } from "@/lib/format";
import { productImageUrl } from "@/lib/product-image";
import { DELIVERY_SENTENCE, isNew, summarisePlans } from "@/lib/storefront";

// The title is what a shared link shows. No price in it: a preview is cached
// by whoever unfurls it, and a stale price there would be a false one.
export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return { title: "Not available · Kunji" };

  const summary = summarisePlans(product.plans);
  const facts = summary
    ? `${accountTypeLabel[product.account_type]}. ${summary.duration}. Warranty: ${summary.warranty.toLowerCase()}.`
    : "";
  const description = product.description.trim().slice(0, 200) || facts;

  return {
    title: `${product.name} · Kunji`,
    description,
    openGraph: {
      title: product.name,
      description,
      siteName: "Kunji",
      type: "website",
      images: product.image_path ? [{ url: productImageUrl(product.image_path) }] : undefined,
    },
  };
}

export default function ProductPage({ params }: PageProps<"/products/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Product params={params} />
      </Suspense>
    </main>
  );
}

async function Product({ params }: Pick<PageProps<"/products/[slug]">, "params">) {
  const product = await getProduct((await params).slug);
  const summary = product && summarisePlans(product.plans);
  // Hidden, never listed, or nothing to buy: to a customer these are the same.
  if (!product || !summary) notFound();

  const extra = [
    ...(product.needs_activation_email
      ? [{ term: "Activation", detail: "On your own email" }]
      : []),
    ...(product.plan_note ? [{ term: "Note", detail: product.plan_note }] : []),
  ];

  return (
    <article>
      <Link
        href={`/?category=${encodeURIComponent(product.category)}`}
        className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        More in {product.category}
      </Link>

      <div className="mt-1 flex gap-4">
        <ProductImage path={product.image_path} name={product.name} size={80} eager />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">{product.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Price summary={summary} />
            <ProductBadges isNew={isNew(new Date(product.created_at), new Date())} soldOut={product.sold_out} />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-card p-3">
        <HonestFacts accountType={product.account_type} summary={summary} extra={extra} />
        <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">{DELIVERY_SENTENCE}</p>
      </div>

      {product.description.trim() && (
        <p className="mt-5 max-w-prose whitespace-pre-line leading-relaxed">{product.description}</p>
      )}

      <section aria-labelledby="plans-heading" className="mt-6">
        <h2 id="plans-heading" className="text-base font-semibold">
          Plans
        </h2>
        {product.sold_out && (
          <p className="mt-1 text-sm">
            Sold out for now. These plans can&apos;t be ordered until it&apos;s back in stock.
          </p>
        )}
        <ul className="mt-2 grid gap-2">
          {product.plans.map((plan) => (
            <li
              key={plan.id}
              className="flex min-h-16 items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{formatDays(plan.duration_days)}</span>
                <span className="block text-sm text-muted-foreground">
                  {formatWarranty(plan.warranty_days)}
                </span>
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {formatRupees(plan.sell_price)}
              </span>
              {/* No buy button on a sold-out product: absent, not greyed out. */}
              {!product.sold_out && (
                <Link
                  href={`/checkout/${plan.id}`}
                  aria-label={`Buy ${formatDays(plan.duration_days)} for ${formatRupees(plan.sell_price)}`}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Buy
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
