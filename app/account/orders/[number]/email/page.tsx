import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmailForm } from "@/components/store/email-form";
import { textLinkClass } from "@/components/store/fields";
import { fixActivationEmail } from "@/lib/actions/checkout";
import { getOrder } from "@/lib/data/orders";

export const metadata: Metadata = { title: "Fix activation email · Kunji" };

export default function FixEmailPage({ params }: PageProps<"/account/orders/[number]/email">) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <FixEmail params={params} />
      </Suspense>
    </main>
  );
}

async function FixEmail({ params }: Pick<PageProps<"/account/orders/[number]/email">, "params">) {
  const order = await getOrder((await params).number);
  if (!order) notFound();
  const back = `/account/orders/${order.number}`;

  return (
    <>
      <Link href={back} className={`${textLinkClass} text-sm`}>
        Back to order <span className="font-mono">#{order.number}</span>
      </Link>
      <h1 className="mt-1 heading-title">Fix activation email</h1>
      {order.status === "awaiting_payment" && order.activation_email ? (
        <>
          <p className="mt-1 mb-5 text-muted-foreground">
            Your {order.product_name} will be activated on the email you save here.
          </p>
          <EmailForm
            action={fixActivationEmail.bind(null, order.id)}
            current={order.activation_email}
          />
        </>
      ) : (
        <p className="mt-3">
          {order.activation_email
            ? "The email can only be changed while the order is waiting for payment."
            : "This order doesn't need an activation email."}
        </p>
      )}
    </>
  );
}
