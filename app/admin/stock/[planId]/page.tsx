import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { NotAdmin } from "@/components/admin/not-admin";
import { RemoveStockButton, StockForm } from "@/components/admin/stock-form";
import { addStock, removeStockItem } from "@/lib/actions/stock";
import { idSchema } from "@/lib/catalogue";
import { viewerSeesAdminRows } from "@/lib/data/admin";
import { getPlanForStock, listStockItems } from "@/lib/data/stock";
import { formatDays, formatPakistanDate, formatRupees } from "@/lib/format";
import { wholeDaysLeft } from "@/lib/stock";

export const metadata: Metadata = { title: "Plan stock · Admin · Kunji" };

const th = "py-1 pr-3 font-medium";
const thNum = "py-1 pl-3 text-right font-medium";
const td = "py-0.5 pr-3";
const tdNum = "py-0.5 pl-3 text-right font-mono tabular-nums";

export default function PlanStockPage({ params }: PageProps<"/admin/stock/[planId]">) {
  return (
    <main className="mt-3 max-w-3xl">
      <Link href="/admin/stock" className="rounded-sm text-xs font-medium text-primary underline-offset-4 hover:underline">
        Stock
      </Link>
      <Suspense fallback={<p className="mt-2 text-muted-foreground">Loading…</p>}>
        <PlanStock params={params} />
      </Suspense>
    </main>
  );
}

async function PlanStock({ params }: { params: Promise<{ planId: string }> }) {
  await connection();
  const { planId } = await params;
  if (!idSchema.safeParse(planId).success) notFound();

  const [isAdmin, plan, items] = await Promise.all([
    viewerSeesAdminRows(),
    getPlanForStock(planId),
    listStockItems(planId),
  ]);
  if (!isAdmin) return <NotAdmin />;
  if (!plan) notFound();

  const now = new Date();
  const product = plan.products;

  return (
    <>
      <h1 className="mt-1 text-sm font-semibold">
        <Link href={`/admin/products/${product.id}`} className="rounded-sm underline-offset-4 hover:underline">
          {product.name}
        </Link>
        , {formatDays(plan.duration_days)}
      </h1>
      <p className="mt-0.5 text-xs text-muted-foreground">
        An item with less than 90% of {formatDays(plan.duration_days)} left is held back, not sold.
      </p>

      <section aria-labelledby="add-heading" className="mt-4">
        <h2 id="add-heading" className="text-xs font-medium text-muted-foreground">
          Add stock
        </h2>
        {/* The form stays so the refusal is the database's, not a hidden button. */}
        {product.needs_activation_email && (
          <p className="mt-1 text-xs text-warning">
            This product needs the customer&apos;s activation email, so it can&apos;t be stocked.
          </p>
        )}
        <div className="mt-1.5">
          <StockForm action={addStock.bind(null, plan.id)} />
        </div>
      </section>

      <section aria-labelledby="items-heading" className="mt-6">
        <h2 id="items-heading" className="text-xs font-medium text-muted-foreground">
          Items
        </h2>
        {items.length === 0 ? (
          <p className="mt-1.5 text-muted-foreground">No stock for this plan yet.</p>
        ) : (
          <div className="mt-1.5 overflow-x-auto">
            <table className="w-full min-w-160 border-collapse text-left">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className={th}>numastore order</th>
                  <th className={thNum}>Cost</th>
                  <th className={th + " pl-3"}>Stops working</th>
                  <th className={th}>State</th>
                  <th className={th}>
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => {
                  const expires = item.expires_at ? new Date(item.expires_at) : null;
                  return (
                    <tr key={item.id}>
                      <td className={`${td} font-mono`}>{item.supplier_order_number}</td>
                      <td className={tdNum}>{item.cost === null ? "—" : formatRupees(item.cost)}</td>
                      <td className={`${td} pl-3`}>
                        {expires && (
                          <>
                            <time dateTime={expires.toISOString()}>{formatPakistanDate(expires)}</time>
                            {!item.used_at && (
                              <span className="text-muted-foreground">
                                , {formatDays(wholeDaysLeft(expires, now))} left
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className={td}>
                        {item.orders ? (
                          <>
                            Delivered on{" "}
                            <Link
                              href={`/admin/orders/${item.orders.number}`}
                              className="rounded-sm font-mono text-primary underline-offset-4 hover:underline"
                            >
                              #{item.orders.number}
                            </Link>
                          </>
                        ) : item.held_back ? (
                          <span className="text-warning">Held back</span>
                        ) : (
                          "Free"
                        )}
                      </td>
                      {/* Delivered items are a customer's login and stay. */}
                      <td className={td}>
                        {!item.orders && item.id && (
                          <RemoveStockButton action={removeStockItem.bind(null, item.id)} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
