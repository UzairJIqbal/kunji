import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { textLinkClass } from "@/components/store/fields";
import { TicketForm } from "@/components/store/ticket-form";
import { openTicket } from "@/lib/actions/tickets";
import { getOrder } from "@/lib/data/orders";
import { hasOpenTicket } from "@/lib/data/tickets";
import { vaultDates } from "@/lib/vault";
import { warrantyRunning } from "@/lib/warranty";

export const metadata: Metadata = { title: "Report a problem · Kunji" };

export default function ReportPage({ params }: PageProps<"/account/orders/[number]/report">) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Report params={params} />
      </Suspense>
    </main>
  );
}

async function Report({ params }: Pick<PageProps<"/account/orders/[number]/report">, "params">) {
  const order = await getOrder((await params).number);
  if (!order) notFound();
  const back = `/account/orders/${order.number}`;

  // The order page says why there's nothing to report: not delivered, out of
  // warranty, or a report already open. The database refuses the same.
  const now = new Date();
  const reportable =
    order.deliveredAt !== null &&
    (order.status === "delivered" || order.status === "replaced") &&
    order.warranty_days > 0 &&
    warrantyRunning(vaultDates(order.deliveredAt, order.duration_days, order.warranty_days).warrantyEndsAt, now);
  if (!reportable || (await hasOpenTicket(order.id))) redirect(back);

  return (
    <>
      <Link href={back} className={`${textLinkClass} text-sm`}>
        Back to order <span className="font-mono">#{order.number}</span>
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Report a problem</h1>
      <p className="mt-1 mb-5 text-muted-foreground">
        With your {order.product_name}. We&apos;ll reply here, on your order.
      </p>
      <TicketForm action={openTicket.bind(null, order.id)} />
    </>
  );
}
