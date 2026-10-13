import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HonestFacts, Price, ProductBadges, ProductImage } from "@/components/store/product-parts";
import { RatingSummary, Stars } from "@/components/store/stars";
import { accountTypeLabel } from "@/lib/catalogue";
import { getProduct, getProductRating, listProductReviews } from "@/lib/data/storefront";
import { formatDays, formatPakistanDate, formatRupees, formatWarranty } from "@/lib/format";
import { productImageUrl } from "@/lib/product-image";
import { reviewerLabel } from "@/lib/reviews";
import { stockTimeLeft } from "@/lib/stock";
import { deliverySentence, isNew, summarisePlans } from "@/lib/storefront";

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
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
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
  const [rating, reviews] = await Promise.all([getProductRating(product.id), listProductReviews(product.id)]);
  const now = new Date();

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
        className="text-link inline-flex min-h-11 items-center text-sm"
      >
        More in {product.category}
      </Link>

      <div className="mt-3 flex gap-4">
        <ProductImage path={product.image_path} name={product.name} size={80} eager />
        <div className="min-w-0 flex-1">
          <h1 className="heading-title">{product.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Price summary={summary} />
            <ProductBadges isNew={isNew(new Date(product.created_at), now)} soldOut={product.sold_out} />
          </div>
          <a href="#reviews-heading" className="inline-flex min-h-11 items-center rounded-sm focus-ring">
            <RatingSummary rating={rating} />
          </a>
        </div>
      </div>

      <div className="surface mt-6 p-4">
        <HonestFacts accountType={product.account_type} summary={summary} extra={extra} />
        <p className="mt-4 border-t border-foreground/10 pt-4 text-sm text-muted-foreground">{deliverySentence(summary.instant)}</p>
      </div>

      {product.description.trim() && (
        <p className="mt-6 max-w-prose whitespace-pre-line leading-relaxed">{product.description}</p>
      )}

      <section aria-labelledby="plans-heading" className="mt-10">
        <h2 id="plans-heading" className="heading-section">
          Plans
        </h2>
        {product.sold_out && (
          <p className="mt-1 text-sm">
            Sold out for now. These plans can&apos;t be ordered until it&apos;s back in stock.
          </p>
        )}
        <ul className="mt-3 grid gap-2">
          {product.plans.map((plan) => (
            <li
              key={plan.id}
              className="surface flex min-h-16 items-center gap-3 px-4 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{formatDays(plan.duration_days)}</span>
                <span className="block text-sm text-muted-foreground">
                  {formatWarranty(plan.warranty_days)}
                </span>
                {/* A stocked login was bought earlier, so the customer is told
                    before buying that it has less than the full plan left. */}
                {plan.instant_until && (
                  <span className="block text-sm">
                    Instant delivery, {stockTimeLeft(new Date(plan.instant_until), now)}
                  </span>
                )}
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {formatRupees(plan.sell_price)}
              </span>
              {/* No buy button on a sold-out product: absent, not greyed out. */}
              {!product.sold_out && (
                <Link
                  href={`/checkout/${plan.id}`}
                  aria-label={`Buy ${formatDays(plan.duration_days)} for ${formatRupees(plan.sell_price)}`}
                  className="btn-primary min-h-11 shrink-0 text-sm"
                >
                  Buy
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="reviews-heading" className="mt-12">
        <h2 id="reviews-heading" className="heading-section scroll-mt-4">
          Reviews
        </h2>
        <div className="mt-1">
          <RatingSummary rating={rating} />
        </div>
        {reviews.length > 0 && (
          <ul className="mt-4 divide-y border-y">
            {reviews.map((review) => (
              <li key={review.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium">{reviewerLabel(review.reviewer_name)}</span>
                  <Stars rating={review.rating} />
                </div>
                <p className="text-sm text-muted-foreground">
                  Bought {formatDays(review.duration_days)}, reviewed {formatPakistanDate(review.created_at)}
                </p>
                {review.comment && (
                  <p className="mt-1.5 max-w-prose whitespace-pre-line break-words">{review.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
