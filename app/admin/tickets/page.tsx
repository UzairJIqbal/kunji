import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NotAdmin } from "@/components/admin/not-admin";
import { LiveTickets } from "@/components/live-tickets";
import { StatusBadge } from "@/components/status-badge";
import { CopyButton } from "@/components/store/copy-button";
import { viewerSeesAdminRows } from "@/lib/data/admin";
import { type TicketListRow, listTickets } from "@/lib/data/tickets";
import { formatDays, formatPakistanTime } from "@/lib/format";
import { daysLeft, vaultDates } from "@/lib/vault";
import { adminTicketStatus, ticketReasonLabel } from "@/lib/warranty";

export const metadata: Metadata = { title: "Tickets · Admin · Kunji" };

const headingClass = "text-xs font-medium text-muted-foreground";
const linkClass = "text-link";

export default function TicketsPage() {
  return (
    <main className="mt-3">
      <h1 className="font-heading text-xl leading-tight">Tickets</h1>
      <Suspense fallback={<p className="mt-1.5 text-muted-foreground">Loading…</p>}>
        <Tickets />
      </Suspense>
    </main>
  );
}

async function Tickets() {
  if (!(await viewerSeesAdminRows())) return <NotAdmin />;
  const { open, closed } = await listTickets();
  // Read after the tickets, so it's this request's time, not the build's.
  const now = new Date();

  return (
    <>
      {/* A new ticket, or one moving on elsewhere, shows without a reload. */}
      <LiveTickets />
      <section aria-labelledby="open-heading" className="mt-3">
        <h2 id="open-heading" className={headingClass}>
          Open, oldest first
        </h2>
        {open.length === 0 ? (
          <p className="mt-1 text-muted-foreground">No open tickets.</p>
        ) : (
          <TicketTable rows={open} now={now} />
        )}
      </section>

      {closed.length > 0 && (
        <section aria-labelledby="closed-heading" className="mt-5">
          <h2 id="closed-heading" className={headingClass}>
            Recently closed
          </h2>
          <TicketTable rows={closed} now={now} />
        </section>
      )}
    </>
  );
}

function TicketTable({ rows, now }: { rows: TicketListRow[]; now: Date }) {
  return (
    <div className="mt-1 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 pr-3 font-medium">Order</th>
            <th className="py-1 pr-3 font-medium">Product</th>
            <th className="py-1 pr-3 font-medium">Problem</th>
            <th className="py-1 pr-3 font-medium">Warranty left</th>
            <th className="py-1 pr-3 font-medium">numastore order</th>
            <th className="py-1 pr-3 font-medium">Status</th>
            <th className="py-1 font-medium">Reported</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((ticket) => {
            const status = adminTicketStatus[ticket.status];
            const left = ticket.deliveredAt
              ? daysLeft(
                  vaultDates(ticket.deliveredAt, ticket.order.duration_days, ticket.order.warranty_days).warrantyEndsAt,
                  now,
                )
              : 0;
            return (
              <tr key={ticket.id}>
                <td className="py-1 pr-3">
                  <Link href={`/admin/tickets/${ticket.id}`} className={`font-mono ${linkClass}`}>
                    #{ticket.order.number}
                  </Link>
                </td>
                <td className="py-1 pr-3">{ticket.order.product_name}</td>
                <td className="py-1 pr-3">{ticketReasonLabel[ticket.reason]}</td>
                <td className={`py-1 pr-3 tabular-nums ${left === 0 ? "text-muted-foreground" : ""}`}>
                  {left === 0 ? "Ended" : formatDays(left)}
                </td>
                <td className="py-1 pr-3">
                  {ticket.supplierOrderNumber ? (
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono">{ticket.supplierOrderNumber}</span>
                      <CopyButton value={ticket.supplierOrderNumber} what="numastore order number" compact />
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-1 pr-3">
                  <StatusBadge tone={status.tone} label={status.label} />
                </td>
                <td className="py-1 text-muted-foreground">{formatPakistanTime(ticket.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
