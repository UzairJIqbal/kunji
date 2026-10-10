import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveOrders } from "@/components/live-orders";
import { StatusBadge } from "@/components/status-badge";
import { textLinkClass } from "@/components/store/fields";
import { PaymentForm } from "@/components/store/payment-form";
import { submitProof } from "@/lib/actions/checkout";
import { paymentMethodLabel } from "@/lib/catalogue";
import { listPayableAccounts } from "@/lib/data/checkout";
import { getOrder } from "@/lib/data/orders";
import { whatsappNumber } from "@/lib/env";
import { formatDays, formatPakistanTime, formatRupees, formatWarranty } from "@/lib/format";
import { customerEventLabel, customerOrderStatus, isExpired } from "@/lib/order-status";
import { whatsappLink } from "@/lib/storefront";

export async function generateMetadata({
  params,
}: PageProps<"/account/orders/[number]">): Promise<Metadata> {
  return { title: `Order #${(await params).number} · Kunji` };
}

// One page per order, from placing it onwards: while it waits for payment it
// is the payment screen, and after that it shows where the order is.
export default function OrderPage({ params }: PageProps<"/account/orders/[number]">) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Order params={params} />
      </Suspense>
    </main>
  );
}

async function Order({ params }: Pick<PageProps<"/account/orders/[number]">, "params">) {
  const order = await getOrder((await params).number);
  if (!order) notFound();

  // Read after the order, so it's this request's time, not the build's.
  const now = new Date();
  const status = customerOrderStatus(order, now);
  const awaiting = order.status === "awaiting_payment";
  const expired = isExpired(order, now);
  const accounts = awaiting ? await listPayableAccounts() : [];
  const help = whatsappLink(whatsappNumber(), `Hi, about my Kunji order #${order.number}`);

  const details = [
    { term: "Product", detail: order.product_name },
    { term: "Plan", detail: formatDays(order.duration_days) },
    { term: "Warranty", detail: formatWarranty(order.warranty_days) },
    { term: "Price", detail: formatRupees(order.price) },
    { term: "Placed", detail: formatPakistanTime(order.created_at) },
  ];
  const timeline = order.order_events.flatMap((event) => {
    const label = customerEventLabel[event.to_status];
    return label ? [{ id: event.id, label, at: event.created_at }] : [];
  });

  return (
    <>
      {/* The seller's decision shows up here as it's made. */}
      <LiveOrders orderId={order.id} />
      <Link href="/account#orders" className={`${textLinkClass} text-sm`}>
        Your orders
      </Link>

      <header className="mt-1">
        {order.activation_email ? (
          <>
            <h1 className="text-2xl font-semibold leading-snug tracking-tight">
              Your {order.product_name} will be activated on{" "}
              <span className="break-all">{order.activation_email}</span>
            </h1>
            {awaiting && (
              <Link href={`/account/orders/${order.number}/email`} className={`${textLinkClass} text-sm`}>
                Wrong email? Fix it
              </Link>
            )}
          </>
        ) : (
          <h1 className="text-2xl font-semibold leading-snug tracking-tight">{order.product_name}</h1>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-mono">Order #{order.number}</span>
          <StatusBadge tone={status.tone} label={status.label} />
        </div>
      </header>

      {order.status === "rejected" && order.rejection && (
        <section aria-labelledby="rejected-heading" className="mt-6 rounded-lg border border-danger p-4 text-sm">
          <h2 id="rejected-heading" className="text-base font-semibold text-danger">
            We couldn&apos;t confirm your payment
          </h2>
          <p className="mt-1">Reason: {order.rejection.reason}</p>
          <p className="mt-2">
            If you did pay,{" "}
            <a href={help} className={textLinkClass}>
              message us on WhatsApp
            </a>{" "}
            and we&apos;ll sort it out.
          </p>
        </section>
      )}

      {order.refund && (
        <section aria-labelledby="refund-heading" className="mt-6 rounded-lg border bg-card p-4">
          <h2 id="refund-heading" className="text-base font-semibold">
            Refunded {formatRupees(order.refund.amount)}
          </h2>
          <dl className="mt-2 grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Sent to</dt>
              <dd className="text-right tabular-nums">
                {order.refund.sent_to}, {paymentMethodLabel[order.refund.method]}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="min-w-0 break-all text-right font-mono">{order.refund.reference}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Sent</dt>
              <dd className="text-right">{formatPakistanTime(order.refund.created_at)}</dd>
            </div>
          </dl>
        </section>
      )}

      {awaiting && (
        <section aria-labelledby="pay-heading" className="mt-6">
          <h2 id="pay-heading" className="sr-only">
            Pay for this order
          </h2>
          {expired ? (
            <p className="mb-4 rounded-lg border px-4 py-3 text-sm">
              This order expired at {formatPakistanTime(order.expires_at)}.{" "}
              <strong className="font-semibold">Already paid? Submit your proof anyway.</strong>
            </p>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">
              Pay by {formatPakistanTime(order.expires_at)}, or the order expires.
            </p>
          )}
          {accounts.length > 0 ? (
            <PaymentForm
              action={submitProof.bind(null, order.id)}
              amount={formatRupees(order.price)}
              accounts={accounts}
            />
          ) : (
            <p className="rounded-lg border px-4 py-6 text-center">
              No payment account is open right now.{" "}
              <a href={help} className={textLinkClass}>
                Message us on WhatsApp
              </a>{" "}
              and we&apos;ll tell you where to pay.
            </p>
          )}
        </section>
      )}

      {order.payment && (
        <section aria-labelledby="proof-heading" className="mt-6 rounded-lg border bg-card p-4">
          <h2 id="proof-heading" className="text-base font-semibold">
            Your proof of payment
          </h2>
          <dl className="mt-2 grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Transaction ID</dt>
              <dd className="min-w-0 break-all text-right font-mono">{order.payment.transaction_id}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Paid from</dt>
              <dd className="text-right tabular-nums">
                {order.payment.sender_number}, {paymentMethodLabel[order.payment.method]}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Sent</dt>
              <dd className="text-right">{formatPakistanTime(order.payment.created_at)}</dd>
            </div>
          </dl>
          <a href={`/account/orders/${order.number}/receipt`} className={`${textLinkClass} text-sm`}>
            View screenshot
          </a>
        </section>
      )}

      <section aria-labelledby="details-heading" className="mt-6">
        <h2 id="details-heading" className="text-base font-semibold">
          Order details
        </h2>
        <dl className="mt-2 divide-y rounded-lg border text-sm">
          {details.map(({ term, detail }) => (
            <div key={term} className="flex justify-between gap-3 px-4 py-2.5">
              <dt className="text-muted-foreground">{term}</dt>
              <dd className="min-w-0 text-right font-medium tabular-nums">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="timeline-heading" className="mt-6">
        <h2 id="timeline-heading" className="text-base font-semibold">
          Timeline
        </h2>
        <ol className="mt-2 grid gap-2 border-l pl-4 text-sm">
          {timeline.map((step) => (
            <li key={step.id}>
              <span className="block font-medium">{step.label}</span>
              <span className="block text-muted-foreground">{formatPakistanTime(step.at)}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-8 text-sm">
        A question about this order?{" "}
        <a href={help} className={textLinkClass}>
          Ask on WhatsApp
        </a>
      </p>
    </>
  );
}
