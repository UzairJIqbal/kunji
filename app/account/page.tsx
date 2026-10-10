import { currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge } from "@/components/status-badge";
import { listOrders } from "@/lib/data/orders";
import { formatDays, formatPakistanTime, formatRupees } from "@/lib/format";
import { customerStatusLabel, statusTone } from "@/lib/order-status";

export const metadata: Metadata = { title: "Your account · Kunji" };

// The proxy has already turned signed-out visitors away; this page only renders
// for someone signed in. The vault is filled by a later phase.
export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Suspense fallback={<div className="h-14" />}>
        <Greeting />
      </Suspense>

      <section id="orders" aria-labelledby="orders-heading" className="mt-8">
        <h2 id="orders-heading" className="text-base font-semibold">
          Orders
        </h2>
        <Suspense fallback={<p className="mt-3 text-sm text-muted-foreground">Loading orders…</p>}>
          <OrderList />
        </Suspense>
      </section>

      <section id="vault" aria-labelledby="vault-heading" className="mt-8">
        <h2 id="vault-heading" className="text-base font-semibold">
          Vault
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Logins for your subscriptions are kept here, visible only to you.
        </p>
        <p className="mt-3 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing in your vault yet. It fills when an order is delivered.
        </p>
      </section>
    </main>
  );
}

async function OrderList() {
  const orders = await listOrders();

  if (orders.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        <p>You haven&apos;t ordered anything yet.</p>
        <Link
          href="/"
          className="mt-2 inline-block font-medium text-primary underline-offset-4 hover:underline"
        >
          Browse the store
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-3 divide-y rounded-lg border">
      {orders.map((order) => (
        <li key={order.id} className="px-4 py-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{order.product_name}</span>
            <span className="shrink-0 tabular-nums">{formatRupees(order.price)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <StatusBadge
              tone={statusTone[order.status]}
              label={customerStatusLabel[order.status]}
            />
            <span className="shrink-0 text-muted-foreground">{formatDays(order.duration_days)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
            <span className="font-mono">#{order.number}</span>
            <span className="shrink-0">{formatPakistanTime(order.created_at)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Display only: the name is shown, never used to decide what someone may see.
async function Greeting() {
  const user = await currentUser();
  const name =
    user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "there";
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
      <p className="mt-1 text-muted-foreground">Signed in as {name}</p>
    </header>
  );
}
