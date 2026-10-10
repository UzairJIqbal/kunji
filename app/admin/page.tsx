import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FindOrder } from "@/components/admin/find-order";
import { ApproveButton, AwaySwitch, RejectForm } from "@/components/admin/verification-forms";
import { LiveOrders } from "@/components/live-orders";
import { approvePayment, rejectPayment, switchAwayOff, switchAwayOn } from "@/lib/actions/verification";
import { paymentMethodLabel } from "@/lib/catalogue";
import { viewerSeesAdminRows } from "@/lib/data/admin";
import { getOrderStatusCounts } from "@/lib/data/orders";
import { type QueueRow, getStoreSettings, listVerificationQueue } from "@/lib/data/verification";
import { formatDays, formatPakistanTime, formatRupees } from "@/lib/format";
import { adminStatusLabel } from "@/lib/order-status";
import { paidIntoLabel } from "@/lib/verification";

export const metadata: Metadata = { title: "Admin · Kunji" };

const headingClass = "text-xs font-medium text-muted-foreground";

// Who counts as an admin is a row in the admins table; this page doesn't check,
// the database refuses the rows to anyone else.
export default function AdminPage() {
  return (
    <main className="mt-3">
      <h1 className="text-sm font-semibold">Admin</h1>

      <section aria-labelledby="queue-heading" className="mt-3">
        <h2 id="queue-heading" className={headingClass}>
          Payments to check, oldest first
        </h2>
        <Suspense fallback={<p className="mt-1.5 text-muted-foreground">Loading…</p>}>
          <Queue />
        </Suspense>
      </section>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <section aria-labelledby="away-heading">
          <h2 id="away-heading" className={headingClass}>
            Away
          </h2>
          <div className="mt-1.5">
            <Suspense fallback={null}>
              <Away />
            </Suspense>
          </div>
        </section>

        <section aria-labelledby="find-heading">
          <h2 id="find-heading" className={headingClass}>
            Find an order
          </h2>
          <div className="mt-1.5">
            <FindOrder />
          </div>
        </section>
      </div>

      <section id="orders" aria-labelledby="orders-heading" className="mt-5">
        <h2 id="orders-heading" className={headingClass}>
          Orders by state
        </h2>
        <Suspense fallback={<p className="mt-1.5 text-muted-foreground">Counting…</p>}>
          <StatusCounts />
        </Suspense>
      </section>
    </main>
  );
}

async function Queue() {
  if (!(await viewerSeesAdminRows())) {
    return (
      <p className="mt-1.5 rounded-md border border-dashed px-3 py-4 text-muted-foreground">
        This account isn&apos;t an admin.
      </p>
    );
  }
  const rows = await listVerificationQueue();
  return (
    <>
      {/* New proof, and decisions made on another device, re-read this list. */}
      <LiveOrders />
      {rows.length === 0 ? (
        <p className="mt-1.5 rounded-md border border-dashed px-3 py-4 text-muted-foreground">
          Nothing to check. New proof shows up here as it arrives.
        </p>
      ) : (
        <ol className="mt-1.5 divide-y rounded-md border">
          {rows.map((row) => (
            <QueueItem key={row.id} row={row} />
          ))}
        </ol>
      )}
    </>
  );
}

function QueueItem({ row }: { row: QueueRow }) {
  const order = row.orders;
  return (
    <li className="flex gap-3 p-2">
      <Receipt url={row.receiptUrl} number={order.number} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <Link
            href={`/admin/orders/${order.number}`}
            className="font-mono font-medium underline-offset-4 hover:underline"
          >
            #{order.number}
          </Link>
          <span className="font-mono font-semibold tabular-nums">{formatRupees(order.price)}</span>
        </div>
        <p className="truncate">
          {order.product_name}, {formatDays(order.duration_days)}
        </p>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-xs">
          <dt className="text-muted-foreground">Paid by</dt>
          <dd>{paymentMethodLabel[row.method]}</dd>
          <dt className="text-muted-foreground">Into</dt>
          <dd className="min-w-0 wrap-break-word">{row.payment_accounts ? paidIntoLabel(row.payment_accounts) : "—"}</dd>
          <dt className="text-muted-foreground">Txn ID</dt>
          <dd className="min-w-0 break-all font-mono">{row.transaction_id}</dd>
          <dt className="text-muted-foreground">From</dt>
          <dd className="min-w-0 break-all font-mono">{row.sender_number}</dd>
          <dt className="text-muted-foreground">Sent</dt>
          <dd>{formatPakistanTime(row.created_at)}</dd>
        </dl>
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <ApproveButton action={approvePayment.bind(null, order.id)} />
          <RejectForm action={rejectPayment.bind(null, order.id)} />
        </div>
      </div>
    </li>
  );
}

// A plain <img>, not next/image: the link is signed for ten minutes, and the
// image optimiser would keep serving it after it should have died.
function Receipt({ url, number }: { url: string | null; number: number }) {
  if (!url) {
    return (
      <div className="flex size-20 shrink-0 items-center justify-center rounded border border-dashed text-center text-xs text-muted-foreground">
        No receipt
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="shrink-0" aria-label={`Receipt for order ${number}, full size`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
      <img src={url} alt="" className="size-20 rounded border object-cover" />
    </a>
  );
}

async function Away() {
  if (!(await viewerSeesAdminRows())) return null;
  const settings = await getStoreSettings();
  return (
    <AwaySwitch away={settings.away} backAt={settings.back_at} switchOn={switchAwayOn} switchOff={switchAwayOff} />
  );
}

async function StatusCounts() {
  const result = await getOrderStatusCounts();

  if (!result.ok) {
    return (
      <p className="mt-1.5 rounded-md border border-dashed px-3 py-4 text-muted-foreground">
        This account isn&apos;t an admin.
      </p>
    );
  }

  const total = result.counts.reduce((sum, row) => sum + row.count, 0);

  return (
    <table className="mt-1.5 w-full max-w-xs border-collapse">
      <tbody>
        {result.counts.map((row) => (
          <tr key={row.status} className="border-b">
            <td className="py-0.5 pr-4">{adminStatusLabel[row.status]}</td>
            <td className="py-0.5 text-right font-mono tabular-nums">{row.count}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="font-semibold">
          <td className="py-0.5 pr-4">Total</td>
          <td className="py-0.5 text-right font-mono tabular-nums">{total}</td>
        </tr>
      </tfoot>
    </table>
  );
}
