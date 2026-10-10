import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/action-button";
import { NotAdmin } from "@/components/admin/not-admin";
import { PlanForm, newPlanValues } from "@/components/admin/plan-form";
import { ProductForm } from "@/components/admin/product-form";
import {
  createPlan,
  markPriceChecked,
  setProductListed,
  setProductSoldOut,
  updatePlan,
  updateProduct,
} from "@/lib/actions/catalogue";
import { idSchema } from "@/lib/catalogue";
import { viewerSeesAdminRows } from "@/lib/data/admin";
import { getProductForAdmin, listCategories } from "@/lib/data/catalogue";
import { formatDaysAgo, formatPakistanTime, formatWarranty } from "@/lib/format";
import { daysSince, isPriceCheckStale } from "@/lib/pricing";
import { productImageUrl } from "@/lib/product-image";

export const metadata: Metadata = { title: "Edit product · Admin · Kunji" };

export default function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  return (
    <main className="mt-3 max-w-2xl">
      <Link
        href="/admin/products"
        className="rounded-sm text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Products
      </Link>
      <Suspense fallback={<p className="mt-2 text-muted-foreground">Loading…</p>}>
        <EditProduct params={params} />
      </Suspense>
    </main>
  );
}

async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const [isAdmin, product, categories] = await Promise.all([
    viewerSeesAdminRows(),
    getProductForAdmin(id),
    listCategories(),
  ]);
  if (!isAdmin) return <NotAdmin />;
  if (!product) notFound();

  const now = new Date();

  return (
    <>
      <header className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-sm font-semibold">{product.name}</h1>
        <span>
          {product.active ? "Listed" : <span className="text-muted-foreground">Hidden</span>}
          {product.sold_out && <span className="text-warning">, sold out</span>}
        </span>
        <span className="flex gap-1.5">
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
      </header>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Address <span className="font-mono">{product.slug}</span>, fixed when the product was created
      </p>

      <section aria-labelledby="details-heading" className="mt-4">
        <h2 id="details-heading" className="text-xs font-medium text-muted-foreground">
          Details
        </h2>
        <div className="mt-1.5">
          <ProductForm
            action={updateProduct.bind(null, product.id)}
            initial={{
              name: product.name,
              category: product.category,
              description: product.description,
              setupInstructions: product.setup_instructions,
              accountType: product.account_type,
              planNote: product.plan_note ?? "",
              needsActivationEmail: product.needs_activation_email,
            }}
            categories={categories}
            imageUrl={product.image_path ? productImageUrl(product.image_path) : null}
            submitLabel="Save details"
          />
        </div>
      </section>

      <section aria-labelledby="plans-heading" className="mt-6">
        <h2 id="plans-heading" className="text-xs font-medium text-muted-foreground">
          Plans
        </h2>
        {product.plans.length === 0 && (
          <p className="mt-1.5 text-muted-foreground">No plans yet. Add one below.</p>
        )}
        <ul className="mt-1.5 divide-y border-y">
          {product.plans.map((plan) => {
            const details = plan.plan_supplier_details;
            const checkedAt = details ? new Date(details.price_checked_at) : null;
            const stale = checkedAt !== null && isPriceCheckStale(checkedAt, now);
            return (
              <li key={plan.id} className="py-3">
                <p className="mb-1.5 text-xs text-muted-foreground">
                  {formatWarranty(plan.warranty_days)}
                </p>
                <PlanForm
                  action={updatePlan.bind(null, plan.id, product.id)}
                  initial={{
                    durationDays: String(plan.duration_days),
                    warrantyDays: String(plan.warranty_days),
                    supplierPrice: details ? String(details.supplier_price) : "",
                    margin: details ? String(details.margin) : "",
                    numastoreUrl: details?.numastore_url ?? "",
                  }}
                  submitLabel="Save plan"
                />
                {details && checkedAt && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <ActionButton
                      action={markPriceChecked.bind(null, plan.id)}
                      label="Price checked"
                      pendingLabel="Saving…"
                    />
                    <span className={stale ? "font-medium text-warning" : "text-muted-foreground"}>
                      Last checked{" "}
                      <time dateTime={checkedAt.toISOString()}>{formatPakistanTime(checkedAt)}</time>,{" "}
                      {formatDaysAgo(daysSince(checkedAt, now))}
                    </span>
                    {/* Opened by the seller in their own browser; the app never fetches it. */}
                    <a
                      href={details.numastore_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Open on numastore
                      <ExternalLink aria-hidden className="size-3" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <h3 className="mt-4 text-xs font-medium text-muted-foreground">Add a plan</h3>
        <div className="mt-1.5">
          <PlanForm
            action={createPlan.bind(null, product.id)}
            initial={newPlanValues}
            submitLabel="Add plan"
            clearOnSave
          />
        </div>
      </section>
    </>
  );
}
