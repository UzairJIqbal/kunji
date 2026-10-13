import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { NotAdmin } from "@/components/admin/not-admin";
import { viewerSeesAdminRows } from "@/lib/data/admin";
import { listStockablePlans } from "@/lib/data/stock";
import { formatDays } from "@/lib/format";
import { wholeDaysLeft } from "@/lib/stock";

export const metadata: Metadata = { title: "Stock · Admin · Kunji" };

const th = "py-1 pr-3 font-medium";
const thNum = "py-1 pl-3 text-right font-medium";
const td = "py-0.5 pr-3";
const tdNum = "py-0.5 pl-3 text-right font-mono tabular-nums";

export default function StockPage() {
  return (
    <main className="mt-3">
      <h1 className="font-heading text-xl leading-tight">Stock</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Logins bought ahead, delivered the moment a payment is approved. Open a plan to add stock. Products that need
        the customer&apos;s activation email can&apos;t be stocked and aren&apos;t listed.
      </p>
      <Suspense fallback={<p className="mt-2 text-muted-foreground">Loading…</p>}>
        <StockTable />
      </Suspense>
    </main>
  );
}

async function StockTable() {
  await connection();
  const [isAdmin, rows] = await Promise.all([viewerSeesAdminRows(), listStockablePlans()]);
  if (!isAdmin) return <NotAdmin />;
  if (rows.length === 0) {
    return <p className="mt-3 text-muted-foreground">No plan can be stocked yet. Add a plan to a product first.</p>;
  }

  const now = new Date();
  const plans = rows
    .map(({ plan, stock }) => ({
      planId: plan.id,
      product: plan.products.name,
      durationDays: plan.duration_days,
      hasStock: stock !== null,
      free: stock?.free ?? 0,
      heldBack: stock?.held_back ?? 0,
      delivered: stock?.delivered ?? 0,
      soonest: stock?.soonest_free_expires_at ? new Date(stock.soonest_free_expires_at) : null,
    }))
    .sort((a, b) => a.product.localeCompare(b.product) || a.durationDays - b.durationDays);

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-140 border-collapse text-left">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th className={th}>Plan</th>
            <th className={thNum}>Free</th>
            <th className={thNum}>Held back</th>
            <th className={thNum}>Delivered</th>
            <th className={thNum}>Oldest free item has</th>
            <th className={th + " pl-3"}>
              <span className="sr-only">Add</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {plans.map((plan) => (
            <tr key={plan.planId}>
              <td className={td}>
                <Link
                  href={`/admin/stock/${plan.planId}`}
                  className="text-link"
                >
                  {plan.product}, {formatDays(plan.durationDays)}
                </Link>
              </td>
              {/* "Ran out" only once there was stock; a plan never stocked just has none. */}
              <td className={`${tdNum} ${plan.hasStock && plan.free === 0 ? "font-sans font-medium text-warning" : ""}`}>
                {plan.hasStock && plan.free === 0 ? "Ran out" : plan.free}
              </td>
              <td className={`${tdNum} ${plan.heldBack > 0 ? "text-warning" : ""}`}>{plan.heldBack}</td>
              <td className={tdNum}>{plan.delivered}</td>
              <td className={tdNum}>{plan.soonest ? `${formatDays(wholeDaysLeft(plan.soonest, now))} left` : "—"}</td>
              <td className={`${td} pl-3`}>
                <Link
                  href={`/admin/stock/${plan.planId}`}
                  className="text-link text-xs"
                >
                  Add stock
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
