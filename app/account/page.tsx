import { currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge } from "@/components/status-badge";
import { listOrders } from "@/lib/data/orders";
import { type VaultListEntry, listVaultEntries } from "@/lib/data/vault";
import { formatDays, formatPakistanDate, formatPakistanTime, formatRupees } from "@/lib/format";
import { customerOrderStatus } from "@/lib/order-status";
import { credentialKindLabel, daysLeft, vaultDates, vaultStanding, vaultStandingBadge } from "@/lib/vault";

export const metadata: Metadata = { title: "Your account · Kunji" };

// The proxy has already turned signed-out visitors away; this page only renders
// for someone signed in.
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
        <Suspense fallback={<p className="mt-3 text-sm text-muted-foreground">Loading your vault…</p>}>
          <Vault />
        </Suspense>
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

  // Read after the orders, so expiry is judged at this request's time.
  const now = new Date();

  return (
    <ul className="mt-3 divide-y rounded-lg border">
      {orders.map((order) => {
        const status = customerOrderStatus(order, now);
        return (
          <li key={order.id}>
            <Link
              href={`/account/orders/${order.number}`}
              className="block px-4 py-3 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-primary">{order.product_name}</span>
                <span className="shrink-0 tabular-nums">{formatRupees(order.price)}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <StatusBadge tone={status.tone} label={status.label} />
                <span className="shrink-0 text-muted-foreground">{formatDays(order.duration_days)}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                <span className="font-mono">#{order.number}</span>
                <span className="shrink-0">{formatPakistanTime(order.created_at)}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

async function Vault() {
  const entries = await listVaultEntries();

  if (entries.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        Nothing in your vault yet. It fills when an order is delivered.
      </p>
    );
  }

  // Read after the entries, so expiry is judged at this request's time.
  const now = new Date();
  const rows = entries.map((entry) => {
    const { expiresAt } = vaultDates(entry.delivered_at, entry.orders.duration_days, entry.orders.warranty_days);
    return { entry, expiresAt, standing: vaultStanding(expiresAt, now) };
  });
  const current = rows.filter((row) => row.standing !== "expired");
  const expired = rows.filter((row) => row.standing === "expired");

  return (
    <>
      {current.length > 0 ? (
        <VaultList rows={current} now={now} />
      ) : (
        <p className="mt-3 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing current. Your expired subscriptions are below.
        </p>
      )}
      {expired.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-semibold">Expired</h3>
          <VaultList rows={expired} now={now} />
        </>
      )}
    </>
  );
}

function VaultList({
  rows,
  now,
}: {
  rows: { entry: VaultListEntry; expiresAt: Date; standing: ReturnType<typeof vaultStanding> }[];
  now: Date;
}) {
  return (
    <ul className="mt-3 divide-y rounded-lg border">
      {rows.map(({ entry, expiresAt, standing }) => {
        const badge = vaultStandingBadge[standing];
        return (
          <li key={entry.order_id}>
            <Link
              href={`/account/vault/${entry.orders.number}`}
              className="block px-4 py-3 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-primary">{entry.orders.product_name}</span>
                <span className="shrink-0 text-muted-foreground">{credentialKindLabel[entry.kind]}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <StatusBadge tone={badge.tone} label={badge.label} />
                <span className="shrink-0 text-muted-foreground">
                  {standing === "expired"
                    ? `Ended ${formatPakistanDate(expiresAt)}`
                    : standing === "expiring_soon"
                      ? `${formatDays(daysLeft(expiresAt, now))} left`
                      : `Until ${formatPakistanDate(expiresAt)}`}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
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
