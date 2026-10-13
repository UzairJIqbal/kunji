import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/action-button";
import { BoughtForm } from "@/components/admin/buying-forms";
import { DeliverForm } from "@/components/admin/deliver-form";
import { NotAdmin } from "@/components/admin/not-admin";
import { ApproveButton, DecisionNotices, RefundForm, RejectForm } from "@/components/admin/verification-forms";
import { LiveOrders } from "@/components/live-orders";
import { RevealCredential } from "@/components/vault/reveal-credential";
import { StatusBadge } from "@/components/status-badge";
import { cannotSupply, markBought, refundUnsuppliedOrder } from "@/lib/actions/buying";
import { revealReplacedCredential } from "@/lib/actions/tickets";
import { deliverOrder, revealCredential } from "@/lib/actions/vault";
import { approvePayment, refundRejectedOrder, rejectPayment } from "@/lib/actions/verification";
import { priceDifference } from "@/lib/buying";
import { paymentMethodLabel } from "@/lib/catalogue";
import { viewerSeesAdminRows } from "@/lib/data/admin";
import { listOrderTickets, listReplacedCredentials } from "@/lib/data/tickets";
import { describeActors, getAdminOrder } from "@/lib/data/verification";
import { formatDays, formatPakistanTime, formatRupees, formatWarranty } from "@/lib/format";
import { adminStatusLabel, statusTone } from "@/lib/order-status";
import { whatsappLink } from "@/lib/storefront";
import { credentialKindLabel } from "@/lib/vault";
import { paidIntoLabel } from "@/lib/verification";
import { adminTicketStatus, ticketReasonLabel } from "@/lib/warranty";

export async function generateMetadata({ params }: PageProps<"/admin/orders/[number]">): Promise<Metadata> {
  return { title: `Order #${(await params).number} · Admin · Kunji` };
}

const headingClass = "text-xs font-medium text-muted-foreground";
const linkClass = "font-medium text-primary underline-offset-4 hover:underline";

export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[number]">) {
  return (
    <main className="mt-3">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Order params={params} />
      </Suspense>
    </main>
  );
}

async function Order({ params }: Pick<PageProps<"/admin/orders/[number]">, "params">) {
  if (!(await viewerSeesAdminRows())) return <NotAdmin />;
  const order = await getAdminOrder((await params).number);
  if (!order) notFound();

  const [tickets, replaced] = order.vault
    ? await Promise.all([listOrderTickets(order.id), listReplacedCredentials(order.id)])
    : [[], []];
  const actors = await describeActors(
    [
      ...order.order_events.map((event) => event.actor_id),
      ...order.reveals.map((reveal) => reveal.revealed_by),
      order.vault?.delivered_by ?? null,
    ],
    order.customer_id,
  );
  const named = (id: string | null) => (id ? (actors.get(id) ?? id) : "the database");
  const profile = order.customer_profiles;

  const details = [
    { term: "Product", detail: `${order.product_name}, ${formatDays(order.duration_days)}` },
    { term: "Warranty", detail: formatWarranty(order.warranty_days) },
    { term: "Price", detail: formatRupees(order.price), mono: true },
    { term: "Activate on", detail: order.activation_email ?? "—" },
    { term: "Placed", detail: formatPakistanTime(order.created_at) },
  ];

  return (
    <DecisionNotices>
      <LiveOrders orderId={order.id} />
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="font-mono text-sm font-semibold">Order #{order.number}</h1>
        <StatusBadge tone={statusTone[order.status]} label={adminStatusLabel[order.status]} />
      </div>

      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        <section aria-labelledby="order-heading">
          <h2 id="order-heading" className={headingClass}>
            Order
          </h2>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3">
            {details.map(({ term, detail, mono }) => (
              <div key={term} className="contents">
                <dt className="text-muted-foreground">{term}</dt>
                <dd className={`min-w-0 break-all ${mono ? "font-mono tabular-nums" : ""}`}>{detail}</dd>
              </div>
            ))}
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="min-w-0">
              {profile ? (
                <>
                  {profile.name}{" "}
                  {profile.whatsapp ? (
                    <a
                      href={whatsappLink(profile.whatsapp, `About your Kunji order #${order.number}`)}
                      target="_blank"
                      rel="noreferrer"
                      className={linkClass}
                    >
                      WhatsApp {profile.whatsapp}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">(no WhatsApp given)</span>
                  )}
                </>
              ) : (
                "—"
              )}
            </dd>
          </dl>
        </section>

        <section aria-labelledby="payment-heading">
          <h2 id="payment-heading" className={headingClass}>
            Payment
          </h2>
          {order.payment ? (
            <>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3">
                <dt className="text-muted-foreground">Paid by</dt>
                <dd>{paymentMethodLabel[order.payment.method]}</dd>
                <dt className="text-muted-foreground">Into</dt>
                <dd className="min-w-0 wrap-break-word">
                  {order.payment.payment_accounts ? paidIntoLabel(order.payment.payment_accounts) : "—"}
                </dd>
                <dt className="text-muted-foreground">Txn ID</dt>
                <dd className="min-w-0 break-all font-mono">{order.payment.transaction_id}</dd>
                <dt className="text-muted-foreground">From</dt>
                <dd className="min-w-0 break-all font-mono">{order.payment.sender_number}</dd>
                <dt className="text-muted-foreground">Sent</dt>
                <dd>{formatPakistanTime(order.payment.created_at)}</dd>
              </dl>
              <a href={`/account/orders/${order.number}/receipt`} target="_blank" rel="noreferrer" className={linkClass}>
                Open receipt
              </a>
            </>
          ) : (
            <p className="mt-1 text-muted-foreground">No proof submitted.</p>
          )}
        </section>
      </div>

      {order.rejection && (
        <p className="mt-4">
          <span className="font-medium text-danger">Rejected:</span> {order.rejection.reason}
        </p>
      )}

      <section aria-labelledby="supplier-heading" className="mt-4">
        <h2 id="supplier-heading" className={headingClass}>
          numastore
        </h2>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3">
          <dt className="text-muted-foreground">Link</dt>
          <dd className="min-w-0 truncate">
            {order.supplier ? (
              <a href={order.supplier.numastore_url} target="_blank" rel="noreferrer" className={`font-mono ${linkClass}`}>
                {order.supplier.numastore_url}
              </a>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-muted-foreground">Listed at</dt>
          <dd className="font-mono tabular-nums">
            {order.supplier ? formatRupees(order.supplier.supplier_price) : "—"}
          </dd>
          {order.purchase && (
            <>
              <dt className="text-muted-foreground">Order no.</dt>
              <dd className="min-w-0 break-all font-mono">{order.purchase.supplier_order_number}</dd>
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="font-mono tabular-nums">{formatRupees(order.purchase.amount_paid)}</dd>
              <dt className="text-muted-foreground">Bought</dt>
              <dd>{formatPakistanTime(order.purchase.created_at)}</dd>
            </>
          )}
          {order.supplyFailure && (
            <>
              <dt className="text-muted-foreground">Couldn&apos;t supply</dt>
              <dd>Recorded {formatPakistanTime(order.supplyFailure.created_at)}; product marked sold out</dd>
            </>
          )}
        </dl>
        {order.purchase && order.supplier && (
          <PriceDifference
            paid={order.purchase.amount_paid}
            listed={order.supplier.supplier_price}
            productId={order.productId}
          />
        )}
      </section>

      {order.refund && (
        <section aria-labelledby="refund-heading" className="mt-4">
          <h2 id="refund-heading" className={headingClass}>
            Refund
          </h2>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3">
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="font-mono tabular-nums">{formatRupees(order.refund.amount)}</dd>
            <dt className="text-muted-foreground">Sent by</dt>
            <dd>{paymentMethodLabel[order.refund.method]}</dd>
            <dt className="text-muted-foreground">To</dt>
            <dd className="font-mono">{order.refund.sent_to}</dd>
            <dt className="text-muted-foreground">Reference</dt>
            <dd className="min-w-0 break-all font-mono">{order.refund.reference}</dd>
            <dt className="text-muted-foreground">Recorded</dt>
            <dd>{formatPakistanTime(order.refund.created_at)}</dd>
          </dl>
        </section>
      )}

      {/* Only the moves the database allows from here. It refuses any other. */}
      {order.status === "verifying" && (
        <section aria-labelledby="decide-heading" className="mt-4">
          <h2 id="decide-heading" className={headingClass}>
            Decide
          </h2>
          <div className="mt-1.5 flex flex-wrap items-start gap-2">
            <ApproveButton number={order.number} action={approvePayment.bind(null, order.id)} />
            <RejectForm action={rejectPayment.bind(null, order.id)} />
          </div>
        </section>
      )}

      {order.status === "rejected" && (
        <section aria-labelledby="decide-heading" className="mt-4 grid gap-4">
          <div>
            <h2 id="decide-heading" className={headingClass}>
              Approve after all
            </h2>
            <div className="mt-1.5">
              <ApproveButton number={order.number} action={approvePayment.bind(null, order.id)} />
            </div>
          </div>
          {order.payment && (
            <div>
              <h2 className={headingClass}>Or refund it</h2>
              <div className="mt-1.5">
                <RefundForm
                  action={refundRejectedOrder.bind(null, order.id)}
                  price={order.price}
                  method={order.payment.method}
                  sentTo={order.payment.sender_number}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {order.status === "paid" && !order.supplyFailure && (
        <section aria-labelledby="buy-heading" className="mt-4">
          <h2 id="buy-heading" className={headingClass}>
            Buy it on numastore, then record it
          </h2>
          <div className="mt-1.5 flex flex-wrap items-end justify-between gap-2">
            <BoughtForm action={markBought.bind(null, order.id)} listedPrice={order.supplier?.supplier_price ?? null} />
            <ActionButton
              action={cannotSupply.bind(null, order.id)}
              label="numastore can't supply it"
              pendingLabel="Marking sold out…"
            />
          </div>
        </section>
      )}

      {order.status === "paid" && order.supplyFailure && (
        <section aria-labelledby="refund-send-heading" className="mt-4">
          <h2 id="refund-send-heading" className={headingClass}>
            Refund to send
          </h2>
          <div className="mt-1.5">
            {order.payment ? (
              <RefundForm
                action={refundUnsuppliedOrder.bind(null, order.id)}
                price={order.price}
                method={order.payment.method}
                sentTo={order.payment.sender_number}
              />
            ) : (
              <p className="text-danger">This order has no payment to refund to.</p>
            )}
          </div>
        </section>
      )}

      {order.status === "bought" && (
        <section aria-labelledby="deliver-heading" className="mt-4">
          <h2 id="deliver-heading" className={headingClass}>
            Deliver: paste what numastore sent
          </h2>
          <div className="mt-1.5">
            <DeliverForm action={deliverOrder.bind(null, order.id)} accountType={order.accountType} />
          </div>
        </section>
      )}

      {order.vault && (
        <section aria-labelledby="vault-heading" className="mt-4">
          <h2 id="vault-heading" className={headingClass}>
            Vault
          </h2>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3">
            <dt className="text-muted-foreground">Kind</dt>
            <dd>{credentialKindLabel[order.vault.kind]}</dd>
            <dt className="text-muted-foreground">Delivered</dt>
            <dd>
              {formatPakistanTime(order.vault.delivered_at)}
              <span className="text-muted-foreground"> by {named(order.vault.delivered_by)}</span>
            </dd>
          </dl>
          <div className="mt-1.5 max-w-md">
            {/* Recorded like the customer's: the seller's look is on the list below. */}
            <RevealCredential reveal={revealCredential.bind(null, order.id)} compact />
          </div>
          <h3 className={`mt-3 ${headingClass}`}>Reveals, latest first</h3>
          {order.reveals.length === 0 ? (
            <p className="mt-1 text-muted-foreground">Not revealed yet.</p>
          ) : (
            <ol className="mt-1 divide-y border-y">
              {order.reveals.map((reveal) => (
                <li key={reveal.id} className="flex flex-wrap justify-between gap-x-3 py-1">
                  <span>
                    {named(reveal.revealed_by)}
                    {reveal.replaced_credential_id !== null && (
                      <span className="text-muted-foreground"> (a replaced credential)</span>
                    )}
                  </span>
                  <span className="text-muted-foreground">{formatPakistanTime(reveal.created_at)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {replaced.length > 0 && (
        <section aria-labelledby="replaced-heading" className="mt-4">
          <h2 id="replaced-heading" className={headingClass}>
            Replaced credentials, latest first
          </h2>
          <ol className="mt-1 grid gap-2">
            {replaced.map((old) => (
              <li key={old.id} className="border-t pt-1.5">
                <p>
                  <span className="font-medium text-muted-foreground">Replaced</span>{" "}
                  {formatPakistanTime(old.replaced_at)}, {credentialKindLabel[old.kind].toLowerCase()}.{" "}
                  {old.replacements?.source === "purchase" ? (
                    <>
                      Bought again as <span className="font-mono">{old.replacements.supplier_order_number}</span> for{" "}
                      <span className="font-mono tabular-nums">{formatRupees(old.replacements.cost)}</span>
                    </>
                  ) : (
                    <>
                      Claimed with numastore, cost <span className="font-mono tabular-nums">{formatRupees(0)}</span>
                    </>
                  )}
                </p>
                <div className="mt-1 max-w-md">
                  <RevealCredential reveal={revealReplacedCredential.bind(null, old.id)} compact />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {tickets.length > 0 && (
        <section aria-labelledby="tickets-heading" className="mt-4">
          <h2 id="tickets-heading" className={headingClass}>
            Tickets
          </h2>
          <ol className="mt-1 divide-y border-y">
            {tickets.map((ticket) => {
              const status = adminTicketStatus[ticket.status];
              return (
                <li key={ticket.id} className="flex flex-wrap justify-between gap-x-3 py-1">
                  <Link href={`/admin/tickets/${ticket.id}`} className={linkClass}>
                    {ticketReasonLabel[ticket.reason]}
                  </Link>
                  <span>
                    <StatusBadge tone={status.tone} label={status.label} />
                    <span className="text-muted-foreground"> {formatPakistanTime(ticket.created_at)}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section aria-labelledby="timeline-heading" className="mt-5">
        <h2 id="timeline-heading" className={headingClass}>
          Timeline
        </h2>
        <ol className="mt-1 divide-y border-y">
          {order.order_events.map((event) => (
            <li key={event.id} className="flex flex-wrap justify-between gap-x-3 py-1">
              <span>
                {event.from_status ? `${adminStatusLabel[event.from_status]} to ` : ""}
                <span className="font-medium">{adminStatusLabel[event.to_status]}</span>
                <span className="text-muted-foreground">
                  {" "}
                  by {named(event.actor_id)}
                </span>
              </span>
              <span className="text-muted-foreground">{formatPakistanTime(event.created_at)}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-4">
        <Link href="/admin" className={linkClass}>
          Back to the queue
        </Link>
      </p>
    </DecisionNotices>
  );
}

// What the seller paid against what the plan lists now. The plan's price is
// never changed for them; this says so and links to where they'd change it.
function PriceDifference({ paid, listed, productId }: { paid: number; listed: number; productId: string }) {
  const difference = priceDifference(paid, listed);
  if (!difference) return null;
  return (
    <p className="mt-1">
      Paid {difference}.{" "}
      <Link href={`/admin/products/${productId}`} className={linkClass}>
        Edit the plan
      </Link>{" "}
      if numastore&apos;s price has changed.
    </p>
  );
}
