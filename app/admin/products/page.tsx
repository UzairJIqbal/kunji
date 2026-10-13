import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/action-button";
import { NotAdmin } from "@/components/admin/not-admin";
import { setProductListed, setProductSoldOut } from "@/lib/actions/catalogue";
import { viewerSeesAdminRows } from "@/lib/data/admin";
import { listProductsForAdmin } from "@/lib/data/catalogue";
import { formatDaysAgo, formatPakistanDate } from "@/lib/format";
import { daysSince, isPriceCheckStale } from "@/lib/pricing";

export const metadata: Metadata = { title: "Products · Admin · Kunji" };

// Columns line up from a small tablet up; on a phone each product wraps onto
// two or three lines instead of scrolling sideways.
const row =
  "flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5 sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_3.5rem_7rem_11rem_13rem] sm:items-center";

export default function ProductsPage() {
  return (
    <main className="mt-3">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-heading text-xl leading-tight">Products</h1>
        <Link
          href="/admin/products/new"
          className="text-link"
        >
          New product
        </Link>
      </div>
      <Suspense fallback={<p className="mt-2 text-muted-foreground">Loading products…</p>}>
        <ProductList />
      </Suspense>
    </main>
  );
}

async function ProductList() {
  const [isAdmin, products] = await Promise.all([viewerSeesAdminRows(), listProductsForAdmin()]);
  if (!isAdmin) return <NotAdmin />;

  if (products.length === 0) {
    return (
      <p className="mt-3 rounded-md bg-card px-3 py-4 text-muted-foreground">
        No products yet. Add the first one with New product.
      </p>
    );
  }

  // Read after the data, so it's the time of this request.
  const now = new Date();

  return (
    <div className="mt-2">
      <div className={`hidden border-b text-xs text-muted-foreground sm:grid ${row}`} aria-hidden>
        <span>Name</span>
        <span>Category</span>
        <span>Plans</span>
        <span>State</span>
        <span>Price checked</span>
        <span />
      </div>
      <ul className="divide-y">
        {products.map((product) => {
          // The oldest check is the one that matters: one stale plan is enough
          // for the seller to go and look.
          const checks = product.plans.flatMap((plan) =>
            plan.plan_supplier_details ? [new Date(plan.plan_supplier_details.price_checked_at)] : [],
          );
          const oldest = checks.length
            ? new Date(Math.min(...checks.map((d) => d.getTime())))
            : null;
          const stale = oldest !== null && isPriceCheckStale(oldest, now);

          return (
            <li key={product.id} className={row}>
              <Link
                href={`/admin/products/${product.id}`}
                className="text-link min-w-0 basis-full truncate sm:basis-auto"
              >
                {product.name}
              </Link>
              <span className="truncate text-muted-foreground">{product.category}</span>
              <span className="tabular-nums">
                {product.plans.length} {product.plans.length === 1 ? "plan" : "plans"}
              </span>
              <span>
                {product.active ? "Listed" : <span className="text-muted-foreground">Hidden</span>}
                {product.sold_out && <span className="text-warning">, sold out</span>}
              </span>
              <span className={stale ? "font-medium text-warning" : undefined}>
                {oldest ? (
                  <time dateTime={oldest.toISOString()}>
                    {formatPakistanDate(oldest)}, {formatDaysAgo(daysSince(oldest, now))}
                  </time>
                ) : (
                  <span className="text-muted-foreground">No plans</span>
                )}
              </span>
              <span className="flex basis-full flex-wrap gap-1.5 sm:basis-auto sm:justify-end">
                <ActionButton
                  action={setProductListed.bind(null, product.id, !product.active)}
                  label={product.active ? "Hide" : "Show"}
                  pendingLabel={product.active ? "Hiding…" : "Showing…"}
                />
                <ActionButton
                  action={setProductSoldOut.bind(null, product.id, !product.sold_out)}
                  label={product.sold_out ? "Back in stock" : "Sold out"}
                  pendingLabel="Saving…"
                />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
