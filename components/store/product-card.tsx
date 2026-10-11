import Link from "next/link";
import type { AccountType } from "@/lib/catalogue";
import type { Rating } from "@/lib/reviews";
import type { PlanSummary } from "@/lib/storefront";
import { HonestFacts, Price, ProductBadges, ProductImage } from "./product-parts";
import { RatingSummary } from "./stars";

export type CardProduct = {
  slug: string;
  name: string;
  account_type: AccountType;
  image_path: string | null;
  sold_out: boolean;
  isNew: boolean;
  summary: PlanSummary;
  rating: Rating;
};

// The whole card is one tap target. The facts are on the card itself, so
// nobody has to open a product to learn what kind of account it is.
export function ProductCard({ product }: { product: CardProduct }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="block rounded-lg border bg-card p-3 hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex gap-3">
        <ProductImage path={product.image_path} name={product.name} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-snug">{product.name}</h3>
            <ProductBadges isNew={product.isNew} soldOut={product.sold_out} />
          </div>
          <div className="mt-1">
            <Price summary={product.summary} />
          </div>
          <RatingSummary rating={product.rating} />
        </div>
      </div>
      <div className="mt-3 border-t pt-3">
        <HonestFacts accountType={product.account_type} summary={product.summary} />
      </div>
    </Link>
  );
}
