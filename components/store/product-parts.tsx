import Image from "next/image";
import { accountTypeLabel, type AccountType } from "@/lib/catalogue";
import { formatRupees } from "@/lib/format";
import { productImageUrl } from "@/lib/product-image";
import { type PlanSummary, deliveryShort } from "@/lib/storefront";

// The pieces a card and a product page share, so the facts sit in the same
// place, in the same words, on both.

// Decorative: the product's name is always right beside it. With no image the
// slot keeps its size, so every card lines up the same way.
export function ProductImage({
  path,
  name,
  size,
  eager = false,
}: {
  path: string | null;
  name: string;
  size: number;
  eager?: boolean;
}) {
  if (!path) {
    return (
      <div
        aria-hidden
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-md bg-raised font-heading text-2xl text-muted-foreground"
      >
        {name.trim().charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <Image
      src={productImageUrl(path)}
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
      loading={eager ? "eager" : "lazy"}
      className="shrink-0 rounded-md bg-raised object-cover"
      style={{ width: size, height: size }}
    />
  );
}

// Both badges are facts the seller set or the calendar decided, in the
// design's olive badge. Not a status colour: olive is the brand's dark.
export function ProductBadges({ isNew, soldOut }: { isNew: boolean; soldOut: boolean }) {
  if (!isNew && !soldOut) return null;
  return (
    <span className="flex shrink-0 gap-1">
      {soldOut && (
        <span className="rounded-sm bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
          Sold out
        </span>
      )}
      {isNew && (
        <span className="rounded-sm bg-raised px-1.5 py-0.5 text-xs font-medium">New</span>
      )}
    </span>
  );
}

// The price as it's read at arm's length: big, with "from" only when there's
// more than one price to choose from.
export function Price({ summary }: { summary: PlanSummary }) {
  return (
    <p className="tabular-nums">
      {summary.pricesVary && <span className="text-sm text-muted-foreground">from </span>}
      <span className="text-xl font-semibold tracking-tight">
        {formatRupees(summary.lowestPrice)}
      </span>
    </p>
  );
}

// The four facts every listing states, in a fixed order. A product page adds
// its extra facts after these four, never in between.
export function HonestFacts({
  accountType,
  summary,
  extra = [],
}: {
  accountType: AccountType;
  summary: PlanSummary;
  extra?: { term: string; detail: string }[];
}) {
  const facts = [
    { term: "You get", detail: accountTypeLabel[accountType] },
    { term: "Duration", detail: summary.duration },
    { term: "Warranty", detail: summary.warranty },
    { term: "Delivery", detail: deliveryShort(summary.instant) },
    ...extra,
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {facts.map(({ term, detail }) => (
        <div key={term} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{term}</dt>
          <dd className="font-medium">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}
