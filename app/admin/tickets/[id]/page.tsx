import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotAdmin } from "@/components/admin/not-admin";
import { ClaimForm, ReplaceByPurchaseForm, ReplaceFromClaimForm } from "@/components/admin/ticket-forms";
import { RefundForm } from "@/components/admin/verification-forms";
import { LiveTickets } from "@/components/live-tickets";
import { StatusBadge } from "@/components/status-badge";
import { CopyButton } from "@/components/store/copy-button";
import { MessageForm, TicketThread } from "@/components/ticket-thread";
import {
  claimTicket,
  refundTicket,
  replaceByPurchase,
  replaceFromClaim,
  sendTicketMessage,
} from "@/lib/actions/tickets";
import { paymentMethodLabel } from "@/lib/catalogue";
import { viewerSeesAdminRows } from "@/lib/data/admin";
import { getAdminTicket } from "@/lib/data/tickets";
import { formatDays, formatPakistanDate, formatPakistanTime, formatRupees } from "@/lib/format";
import { adminStatusLabel, statusTone } from "@/lib/order-status";
import { whatsappLink } from "@/lib/storefront";
import { daysLeft, vaultDates } from "@/lib/vault";
import { adminTicketStatus, proRataRefund, ticketIsOpen, ticketReasonLabel } from "@/lib/warranty";

export const metadata: Metadata = { title: "Ticket · Admin · Kunji" };

const headingClass = "text-xs font-medium text-muted-foreground";
const linkClass = "font-medium text-primary underline-offset-4 hover:underline";

export default function AdminTicketPage({ params }: PageProps<"/admin/tickets/[id]">) {
  return (
    <main className="mt-3">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Ticket params={params} />
      </Suspense>
    </main>
  );
}

async function Ticket({ params }: Pick<PageProps<"/admin/tickets/[id]">, "params">) {
  if (!(await viewerSeesAdminRows())) return <NotAdmin />;
  const ticket = await getAdminTicket((await params).id);
  if (!ticket) notFound();

  const { order, vault, payment } = ticket;
  // Read after the ticket, so it's this request's time, not the build's.
  const now = new Date();
  const dates = vault ? vaultDates(vault.delivered_at, order.duration_days, order.warranty_days) : null;
  const status = adminTicketStatus[ticket.status];
  const open = ticketIsOpen(ticket.status);
  // The unused share is counted to the subscription's end, not the warranty's:
  // it's what the customer paid for and won't get.
  const subscriptionDaysLeft = dates ? Math.min(daysLeft(dates.expiresAt, now), order.duration_days) : 0;
  const suggested = proRataRefund(order.price, subscriptionDaysLeft, order.duration_days);
  const profile = order.customer_profiles;

  return (
    <>
      <LiveTickets ticketId={ticket.id} />
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-sm font-semibold">
          {ticketReasonLabel[ticket.reason]} on{" "}
          <Link href={`/admin/orders/${order.number}`} className={`font-mono ${linkClass}`}>
            #{order.number}
          </Link>
        </h1>
        <StatusBadge tone={status.tone} label={status.label} />
        <span className="text-muted-foreground">
          Order <StatusBadge tone={statusTone[order.status]} label={adminStatusLabel[order.status]} />
        </span>
      </div>

      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        <section aria-labelledby="problem-heading">
          <h2 id="problem-heading" className={headingClass}>
            What the customer reported, {formatPakistanTime(ticket.created_at)}
          </h2>
          {ticket.note ? (
            <p className="mt-1 whitespace-pre-line break-words">{ticket.note}</p>
          ) : (
            <p className="mt-1 text-muted-foreground">No note.</p>
          )}
          {ticket.screenshotUrl && (
            <a href={ticket.screenshotUrl} target="_blank" rel="noreferrer" className={linkClass}>
              Open screenshot
            </a>
          )}
        </section>

        <section aria-labelledby="order-heading">
          <h2 id="order-heading" className={headingClass}>
            Order
          </h2>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3">
            <dt className="text-muted-foreground">Product</dt>
            <dd>
              {order.product_name}, {formatDays(order.duration_days)}
            </dd>
            <dt className="text-muted-foreground">Price</dt>
            <dd className="font-mono tabular-nums">{formatRupees(order.price)}</dd>
            <dt className="text-muted-foreground">Delivered</dt>
            <dd>{vault ? formatPakistanTime(vault.delivered_at) : "—"}</dd>
            <dt className="text-muted-foreground">Warranty</dt>
            <dd>
              {dates
                ? daysLeft(dates.warrantyEndsAt, now) > 0
                  ? `${formatDays(daysLeft(dates.warrantyEndsAt, now))} left, to ${formatPakistanDate(dates.warrantyEndsAt)}`
                  : `Ended ${formatPakistanDate(dates.warrantyEndsAt)}`
                : "—"}
            </dd>
            <dt className="text-muted-foreground">Expires</dt>
            <dd>
              {dates ? `${formatPakistanDate(dates.expiresAt)}, ${formatDays(subscriptionDaysLeft)} left` : "—"}
            </dd>
            <dt className="text-muted-foreground">numastore</dt>
            <dd className="flex min-w-0 items-center gap-1.5">
              {ticket.supplierOrderNumber ? (
                <>
                  <span className="break-all font-mono">{ticket.supplierOrderNumber}</span>
                  <CopyButton value={ticket.supplierOrderNumber} what="numastore order number" compact />
                </>
              ) : (
                "—"
              )}
            </dd>
            {ticket.claim && (
              <>
                <dt className="text-muted-foreground">Claim ref.</dt>
                <dd className="min-w-0 break-all font-mono">
                  {ticket.claim.supplier_reference}
                  <span className="font-sans text-muted-foreground"> {formatPakistanTime(ticket.claim.created_at)}</span>
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="min-w-0">
              {profile?.name ?? "—"}{" "}
              {profile?.whatsapp && (
                <a
                  href={whatsappLink(profile.whatsapp, `About your Kunji order #${order.number}`)}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  WhatsApp {profile.whatsapp}
                </a>
              )}
            </dd>
          </dl>
        </section>
      </div>

      <section aria-labelledby="thread-heading" className="mt-4 max-w-xl">
        <h2 id="thread-heading" className={headingClass}>
          Messages
        </h2>
        <div className="mt-1 grid gap-2">
          {ticket.messages.length === 0 && <p className="text-muted-foreground">No messages yet.</p>}
          <TicketThread messages={ticket.messages} viewer="seller" />
          {open && <MessageForm action={sendTicketMessage.bind(null, ticket.id)} viewer="seller" />}
        </div>
      </section>

      {ticket.replacement && (
        <section aria-labelledby="outcome-heading" className="mt-4">
          <h2 id="outcome-heading" className={headingClass}>
            Replaced {formatPakistanTime(ticket.replacement.created_at)}
          </h2>
          <p className="mt-1">
            {ticket.replacement.source === "claim" ? "From the numastore claim" : "Bought again on numastore as "}
            {ticket.replacement.supplier_order_number && (
              <span className="font-mono">{ticket.replacement.supplier_order_number}</span>
            )}
            , cost <span className="font-mono tabular-nums">{formatRupees(ticket.replacement.cost)}</span>.{" "}
            <Link href={`/admin/orders/${order.number}#replaced-heading`} className={linkClass}>
              Old credential
            </Link>
          </p>
        </section>
      )}

      {ticket.status === "refunded" && ticket.refund && (
        <section aria-labelledby="outcome-heading" className="mt-4">
          <h2 id="outcome-heading" className={headingClass}>
            Refunded {formatPakistanTime(ticket.refund.created_at)}
          </h2>
          <p className="mt-1">
            <span className="font-mono tabular-nums">{formatRupees(ticket.refund.amount)}</span> by{" "}
            {paymentMethodLabel[ticket.refund.method]} to <span className="font-mono">{ticket.refund.sent_to}</span>,
            ref. <span className="break-all font-mono">{ticket.refund.reference}</span>
          </p>
        </section>
      )}

      {/* Only the moves the database allows from here. It refuses any other. */}
      {open && (
        <div className="mt-4 grid gap-4">
          {ticket.status === "open" && (
            <section aria-labelledby="claim-heading">
              <h2 id="claim-heading" className={headingClass}>
                Claimed with numastore? Copy the order number above into their support ticket, then record it
              </h2>
              <div className="mt-1.5">
                <ClaimForm action={claimTicket.bind(null, ticket.id)} />
              </div>
            </section>
          )}

          {ticket.status === "claimed" && vault && (
            <section aria-labelledby="from-claim-heading">
              <h2 id="from-claim-heading" className={headingClass}>
                Replace from the claim: paste what numastore sent
              </h2>
              <div className="mt-1.5">
                <ReplaceFromClaimForm action={replaceFromClaim.bind(null, ticket.id)} initialKind={vault.kind} />
              </div>
            </section>
          )}

          {vault && (
            <section aria-labelledby="purchase-heading">
              <h2 id="purchase-heading" className={headingClass}>
                {ticket.status === "claimed" ? "Or, if numastore refused, buy" : "Replace by buying"} a new one on
                numastore
              </h2>
              <div className="mt-1.5">
                <ReplaceByPurchaseForm action={replaceByPurchase.bind(null, ticket.id)} initialKind={vault.kind} />
              </div>
            </section>
          )}

          <section aria-labelledby="refund-heading">
            <h2 id="refund-heading" className={headingClass}>
              Or refund it
            </h2>
            <div className="mt-1.5">
              {payment ? (
                <RefundForm
                  action={refundTicket.bind(null, ticket.id)}
                  price={order.price}
                  method={payment.method}
                  sentTo={payment.sender_number}
                  suggestion={{
                    amount: suggested,
                    reason: `${formatDays(subscriptionDaysLeft)} left of ${formatDays(order.duration_days)}`,
                  }}
                />
              ) : (
                <p className="text-danger">This order has no payment to refund to.</p>
              )}
            </div>
          </section>
        </div>
      )}

      <p className="mt-4">
        <Link href="/admin/tickets" className={linkClass}>
          Back to tickets
        </Link>
      </p>
    </>
  );
}
