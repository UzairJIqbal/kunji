import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotAdmin } from "@/components/admin/not-admin";
import { ApproveButton, RefundForm, RejectForm } from "@/components/admin/verification-forms";
import { LiveOrders } from "@/components/live-orders";
import { StatusBadge } from "@/components/status-badge";
import { approvePayment, refundRejectedOrder, rejectPayment } from "@/lib/actions/verification";
import { paymentMethodLabel } from "@/lib/catalogue";
import { viewerSeesAdminRows } from "@/lib/data/admin";
import { describeActors, getAdminOrder } from "@/lib/data/verification";
import { formatDays, formatPakistanTime, formatRupees, formatWarranty } from "@/lib/format";
import { adminStatusLabel, statusTone } from "@/lib/order-status";
import { whatsappLink } from "@/lib/storefront";
import { paidIntoLabel } from "@/lib/verification";

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

  const actors = await describeActors(
    order.order_events.map((event) => event.actor_id),
    order.customer_id,
  );
  const profile = order.customer_profiles;

  const details = [
    { term: "Product", detail: `${order.product_name}, ${formatDays(order.duration_days)}` },
    { term: "Warranty", detail: formatWarranty(order.warranty_days) },
    { term: "Price", detail: formatRupees(order.price), mono: true },
    { term: "Activate on", detail: order.activation_email ?? "—" },
    { term: "Placed", detail: formatPakistanTime(order.created_at) },
  ];

  return (
    <>
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
            <ApproveButton action={approvePayment.bind(null, order.id)} />
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
              <ApproveButton action={approvePayment.bind(null, order.id)} />
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
                  by {event.actor_id ? (actors.get(event.actor_id) ?? event.actor_id) : "the database"}
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
    </>
  );
}
