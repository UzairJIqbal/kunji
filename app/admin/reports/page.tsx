import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { NotAdmin } from "@/components/admin/not-admin";
import { getReport } from "@/lib/data/reports";
import { formatPakistanDate, formatRupees } from "@/lib/format";
import {
  DEFAULT_REPORT_PERIOD,
  REPORT_PERIODS,
  type ReportPeriod,
  type WaitingTime,
  formatWait,
  marginGaps,
  periodRange,
  profitPercent,
  reportPeriodLabel,
  reportPeriodSchema,
  reportTotals,
} from "@/lib/reports";

export const metadata: Metadata = { title: "Reports · Admin · Kunji" };

const headingClass = "text-xs font-medium text-muted-foreground";
const th = "py-1 pr-3 font-medium";
const thNum = "py-1 pl-3 text-right font-medium";
const td = "py-0.5 pr-3";
const tdNum = "py-0.5 pl-3 text-right font-mono tabular-nums";
const empty = "mt-1.5 rounded-md bg-card px-3 py-3 text-muted-foreground";

const waitStepLabel: Record<string, string> = {
  proof_to_approved: "Proof sent to approved",
  approved_to_bought: "Approved to bought on numastore",
  bought_to_delivered: "Bought to delivered",
  total: "Proof sent to delivered",
};
const WAIT_STEPS = ["proof_to_approved", "approved_to_bought", "bought_to_delivered", "total"];

export default function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <main className="mt-3">
      <h1 className="font-heading text-xl leading-tight">Reports</h1>
      <Suspense fallback={<p className="mt-2 text-muted-foreground">Adding up…</p>}>
        <PeriodReport searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function PeriodReport({ searchParams }: Pick<PageProps<"/admin/reports">, "searchParams">) {
  const { period: raw } = await searchParams;
  const period = reportPeriodSchema.catch(DEFAULT_REPORT_PERIOD).parse(raw);

  return (
    <>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <nav aria-label="Period" className="flex flex-wrap gap-1">
          {REPORT_PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin/reports?period=${p}`}
              aria-current={p === period ? "page" : undefined}
              className="rounded-sm bg-secondary px-2 py-0.5 font-medium focus-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {reportPeriodLabel[p]}
            </Link>
          ))}
        </nav>
        {/* A plain link: the file is made on the server with the seller's own session. */}
        <a
          href={`/admin/reports/export?period=${period}`}
          className="text-link"
        >
          Download this period&apos;s orders (CSV)
        </a>
      </div>

      <Suspense key={period} fallback={<p className="mt-3 text-muted-foreground">Adding up…</p>}>
        <Report period={period} />
      </Suspense>
    </>
  );
}

function rangeLabel(period: ReportPeriod, now: Date): string {
  const { from, to } = periodRange(period, now);
  if (!from || !to) return "Everything on record";
  // The range ends just before midnight; the last day is the one before it.
  return `${formatPakistanDate(from)} to ${formatPakistanDate(new Date(to.getTime() - 1))}, Pakistan time`;
}

async function Report({ period }: { period: ReportPeriod }) {
  // "This week" depends on when it's asked, so it's never prerendered.
  await connection();
  const now = new Date();
  const report = await getReport(periodRange(period, now));
  if (!report.ok) return <NotAdmin />;

  const { products, waits } = report.rows;
  const totals = reportTotals(products);
  const gaps = marginGaps(products);
  const sold = products.filter((p) => p.delivered > 0);
  const afterSale = products.filter(
    (p) => p.warranty_refunds > 0 || p.claim_replacements > 0 || p.paid_replacements > 0,
  );
  const outOfStock = products.filter((p) => p.out_of_stock_refunds > 0);
  const percent = profitPercent(totals.profit, totals.revenue);
  const percentAfter = profitPercent(totals.profitAfterEverything, totals.revenue);

  return (
    <div className="mt-2">
      <p className="text-xs text-muted-foreground">{rangeLabel(period, now)}</p>

      <section aria-labelledby="summary-heading" className="mt-3">
        <h2 id="summary-heading" className={headingClass}>
          Profit after everything
        </h2>
        <table className="mt-1.5 w-full max-w-sm border-collapse">
          <tbody>
            <tr className="border-b">
              <td className={td}>Revenue from {totals.delivered} delivered</td>
              <td className={tdNum}>{formatRupees(totals.revenue)}</td>
            </tr>
            <tr className="border-b">
              <td className={td}>Paid to numastore</td>
              <td className={tdNum}>−{formatRupees(totals.supplierCost)}</td>
            </tr>
            <tr className="border-b">
              <td className={td}>
                Refunds after delivery ({totals.warrantyRefunds})
              </td>
              <td className={tdNum}>−{formatRupees(totals.warrantyRefundAmount)}</td>
            </tr>
            <tr className="border-b">
              <td className={td}>Replacements you paid for ({totals.paidReplacements})</td>
              <td className={tdNum}>−{formatRupees(totals.paidReplacementCost)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className={td}>Profit after everything</td>
              <td className={`${tdNum} ${totals.profitAfterEverything < 0 ? "text-danger" : ""}`}>
                {formatRupees(totals.profitAfterEverything)}
                {percentAfter !== null && <span className="font-normal text-muted-foreground"> {percentAfter}%</span>}
              </td>
            </tr>
          </tfoot>
        </table>
        {totals.rejectedRefunds > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Also sent back for rejected payments: {totals.rejectedRefunds} ({formatRupees(totals.rejectedRefundAmount)}).
            That money was never revenue, so it isn&apos;t taken off.
          </p>
        )}
      </section>

      <section aria-labelledby="sales-heading" className="mt-5">
        <h2 id="sales-heading" className={headingClass}>
          Sales, by product
        </h2>
        {sold.length === 0 ? (
          <p className={empty}>No orders delivered in this period.</p>
        ) : (
          <div className="mt-1.5 overflow-x-auto">
            <table className="w-full min-w-140 border-collapse text-left">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className={th}>Product</th>
                  <th className={thNum}>Delivered</th>
                  <th className={thNum}>Revenue</th>
                  <th className={thNum}>numastore cost</th>
                  <th className={thNum}>Profit</th>
                  <th className={thNum}>%</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sold.map((p) => {
                  const profit = p.revenue - p.supplier_cost;
                  const share = profitPercent(profit, p.revenue);
                  return (
                    <tr key={p.product_id}>
                      <td className={td}>{p.product_name}</td>
                      <td className={tdNum}>{p.delivered}</td>
                      <td className={tdNum}>{formatRupees(p.revenue)}</td>
                      <td className={tdNum}>{formatRupees(p.supplier_cost)}</td>
                      <td className={`${tdNum} ${profit < 0 ? "text-danger" : ""}`}>{formatRupees(profit)}</td>
                      <td className={tdNum}>{share === null ? "—" : `${share}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className={td}>Total</td>
                  <td className={tdNum}>{totals.delivered}</td>
                  <td className={tdNum}>{formatRupees(totals.revenue)}</td>
                  <td className={tdNum}>{formatRupees(totals.supplierCost)}</td>
                  <td className={`${tdNum} ${totals.profit < 0 ? "text-danger" : ""}`}>{formatRupees(totals.profit)}</td>
                  <td className={tdNum}>{percent === null ? "—" : `${percent}%`}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="margin-heading" className="mt-5">
        <h2 id="margin-heading" className={headingClass}>
          Margin, planned against real. Below plan first: numastore charged more than the plan says.
        </h2>
        {gaps.length === 0 ? (
          <p className={empty}>No orders delivered in this period.</p>
        ) : (
          <div className="mt-1.5 overflow-x-auto">
            <table className="w-full min-w-120 border-collapse text-left">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className={th}>Product</th>
                  <th className={thNum}>Delivered</th>
                  <th className={thNum}>Planned</th>
                  <th className={thNum}>Real</th>
                  <th className={thNum}>Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {gaps.map((g) => (
                  <tr key={g.productId}>
                    <td className={td}>
                      <Link href={`/admin/products/${g.productId}`} className="underline-offset-4 hover:underline">
                        {g.productName}
                      </Link>
                    </td>
                    <td className={tdNum}>{g.delivered}</td>
                    <td className={tdNum}>{formatRupees(g.planned)}</td>
                    <td className={tdNum}>{formatRupees(g.real)}</td>
                    <td className={`${tdNum} ${g.gap < 0 ? "text-danger" : ""}`}>
                      {g.gap > 0 ? "+" : g.gap < 0 ? "−" : ""}
                      {formatRupees(Math.abs(g.gap))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="after-sale-heading" className="mt-5">
        <h2 id="after-sale-heading" className={headingClass}>
          Refunds and replacements after delivery
        </h2>
        {afterSale.length === 0 ? (
          <p className={empty}>None in this period.</p>
        ) : (
          <div className="mt-1.5 overflow-x-auto">
            <table className="w-full min-w-155 border-collapse text-left">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className={th}>Product</th>
                  <th className={thNum}>Refunds</th>
                  <th className={thNum}>Refunded</th>
                  <th className={thNum}>Replaced, numastore covered</th>
                  <th className={thNum}>Replaced, you paid</th>
                  <th className={thNum}>Replacement cost</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {afterSale.map((p) => (
                  <tr key={p.product_id}>
                    <td className={td}>{p.product_name}</td>
                    <td className={tdNum}>{p.warranty_refunds}</td>
                    <td className={tdNum}>{formatRupees(p.warranty_refund_amount)}</td>
                    <td className={tdNum}>{p.claim_replacements}</td>
                    <td className={tdNum}>{p.paid_replacements}</td>
                    <td className={tdNum}>{formatRupees(p.paid_replacement_cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className={td}>Total</td>
                  <td className={tdNum}>{totals.warrantyRefunds}</td>
                  <td className={tdNum}>{formatRupees(totals.warrantyRefundAmount)}</td>
                  <td className={tdNum}>{totals.claimReplacements}</td>
                  <td className={tdNum}>{totals.paidReplacements}</td>
                  <td className={tdNum}>{formatRupees(totals.paidReplacementCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="stock-heading" className="mt-5">
        <h2 id="stock-heading" className={headingClass}>
          Refunded because numastore was out of stock
        </h2>
        {outOfStock.length === 0 ? (
          <p className={empty}>None in this period.</p>
        ) : (
          <table className="mt-1.5 w-full max-w-md border-collapse text-left">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className={th}>Product</th>
                <th className={thNum}>Refunds</th>
                <th className={thNum}>Refunded</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {outOfStock.map((p) => (
                <tr key={p.product_id}>
                  <td className={td}>{p.product_name}</td>
                  <td className={tdNum}>{p.out_of_stock_refunds}</td>
                  <td className={tdNum}>{formatRupees(p.out_of_stock_refund_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Waits waits={waits} />
    </div>
  );
}

// Each step counts in the period it finished.
function Waits({ waits }: { waits: WaitingTime[] }) {
  const byStep = new Map(waits.map((w) => [w.step, w]));
  const total = byStep.get("total");
  return (
    <section aria-labelledby="waits-heading" className="mt-5">
      <h2 id="waits-heading" className={headingClass}>
        How long orders waited
      </h2>
      {waits.length === 0 ? (
        <p className={empty}>No step finished in this period.</p>
      ) : (
        <>
          <div className="mt-1.5 overflow-x-auto">
            <table className="w-full min-w-120 max-w-xl border-collapse text-left">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className={th}>Step</th>
                  <th className={thNum}>Orders</th>
                  <th className={thNum}>Median</th>
                  <th className={thNum}>Slowest</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {WAIT_STEPS.map((step) => {
                  const w = byStep.get(step);
                  return (
                    <tr key={step} className={step === "total" ? "font-semibold" : undefined}>
                      <td className={td}>{waitStepLabel[step]}</td>
                      <td className={tdNum}>{w?.orders ?? 0}</td>
                      <td className={tdNum}>{w ? formatWait(w.median_seconds) : "—"}</td>
                      <td className={tdNum}>{w ? formatWait(w.slowest_seconds) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {total && (
            <p className="mt-1 text-xs">
              <span className={`font-mono tabular-nums ${total.over_30_minutes > 0 ? "text-warning" : ""}`}>
                {total.over_30_minutes}
              </span>{" "}
              of {total.orders} took over 30 minutes from proof to delivery.
            </p>
          )}
        </>
      )}
    </section>
  );
}
