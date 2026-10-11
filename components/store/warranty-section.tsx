import Link from "next/link";
import { LiveTickets } from "@/components/live-tickets";
import { StatusBadge } from "@/components/status-badge";
import { MessageForm, TicketThread } from "@/components/ticket-thread";
import { sendTicketMessage } from "@/lib/actions/tickets";
import type { OrderTicket } from "@/lib/data/tickets";
import { formatPakistanDate, formatPakistanTime } from "@/lib/format";
import { customerTicketStatus, ticketIsOpen, ticketReasonLabel, warrantyRunning } from "@/lib/warranty";
import { primaryButtonClass, textLinkClass } from "./fields";

// Where a delivered order's warranty stands: the button to report a problem
// while it runs, the date it ended once it hasn't, and any report already
// made with its thread. Nothing here is about the supplier; the ticket rows a
// customer can read don't carry it.
export function WarrantySection({
  orderId,
  orderNumber,
  canReport,
  warrantyDays,
  warrantyEndsAt,
  now,
  tickets,
  help,
}: {
  orderId: string;
  orderNumber: number;
  // Delivered or replaced: an order already refunded has nothing to report.
  canReport: boolean;
  warrantyDays: number;
  warrantyEndsAt: Date;
  now: Date;
  tickets: OrderTicket[];
  help: string;
}) {
  const open = tickets.find((ticket) => ticketIsOpen(ticket.status));
  const closed = tickets.filter((ticket) => !ticketIsOpen(ticket.status));

  return (
    <section aria-labelledby="warranty-heading" className="mt-6">
      {/* A ticket opening elsewhere, or the seller closing one, shows here. */}
      <LiveTickets orderId={orderId} />
      <h2 id="warranty-heading" className="text-base font-semibold">
        Problem with it?
      </h2>

      {open ? (
        <OpenTicket ticket={open} />
      ) : canReport && warrantyDays > 0 && warrantyRunning(warrantyEndsAt, now) ? (
        <div className="mt-2">
          <p className="mb-3 text-sm text-muted-foreground">
            Warranty until {formatPakistanDate(warrantyEndsAt)}. If it stops working before then, we&apos;ll
            replace it or refund you.
          </p>
          <Link href={`/account/orders/${orderNumber}/report`} className={primaryButtonClass}>
            Report a problem
          </Link>
        </div>
      ) : (
        <p className="mt-1 text-sm">
          {warrantyDays === 0
            ? "This plan has no warranty."
            : `Warranty ended ${formatPakistanDate(warrantyEndsAt)}.`}{" "}
          <a href={help} className={textLinkClass}>
            Message us on WhatsApp
          </a>
        </p>
      )}

      {closed.length > 0 && (
        <ul className="mt-4 divide-y rounded-lg border text-sm">
          {closed.map((ticket) => {
            const status = customerTicketStatus[ticket.status];
            return (
              <li key={ticket.id} className="flex justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block font-medium">{ticketReasonLabel[ticket.reason]}</span>
                  <span className="block text-muted-foreground">Reported {formatPakistanDate(ticket.created_at)}</span>
                </span>
                <StatusBadge tone={status.tone} label={status.label} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function OpenTicket({ ticket }: { ticket: OrderTicket }) {
  const status = customerTicketStatus[ticket.status];
  return (
    <div className="mt-2 grid gap-4 rounded-lg border bg-card p-4">
      <LiveTickets ticketId={ticket.id} />
      <div>
        <p className="text-base font-semibold">
          <StatusBadge tone={status.tone} label={status.label} />
        </p>
        <p className="mt-1 text-sm">
          {ticketReasonLabel[ticket.reason]}, reported {formatPakistanTime(ticket.created_at)}
        </p>
        {ticket.note && <p className="mt-1 whitespace-pre-line break-words text-sm">{ticket.note}</p>}
        {ticket.screenshotUrl && (
          <a href={ticket.screenshotUrl} target="_blank" rel="noreferrer" className={`${textLinkClass} text-sm`}>
            View your screenshot
          </a>
        )}
      </div>
      <TicketThread messages={ticket.messages} viewer="customer" />
      <MessageForm action={sendTicketMessage.bind(null, ticket.id)} viewer="customer" />
    </div>
  );
}
