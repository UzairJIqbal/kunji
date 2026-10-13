import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveOrders } from "@/components/live-orders";
import { LiveTickets } from "@/components/live-tickets";
import { StatusBadge } from "@/components/status-badge";
import { primaryButtonClass, textLinkClass } from "@/components/store/fields";
import { RevealCredential } from "@/components/vault/reveal-credential";
import { revealCredential } from "@/lib/actions/vault";
import { vaultTicketState } from "@/lib/data/tickets";
import { getVaultEntry } from "@/lib/data/vault";
import { whatsappNumber } from "@/lib/env";
import { formatDays, formatPakistanDate, formatPakistanTime, formatWarranty } from "@/lib/format";
import { whatsappLink } from "@/lib/storefront";
import { warrantyRunning } from "@/lib/warranty";
import { credentialKindLabel, daysLeft, vaultDates, vaultStanding, vaultStandingBadge } from "@/lib/vault";

export async function generateMetadata({ params }: PageProps<"/account/vault/[number]">): Promise<Metadata> {
  return { title: `Vault · order #${(await params).number} · Kunji` };
}

// One delivered subscription. The page itself never holds the credential:
// it arrives only when the customer taps to see it.
export default function VaultEntryPage({ params }: PageProps<"/account/vault/[number]">) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Entry params={params} />
      </Suspense>
    </main>
  );
}

async function Entry({ params }: Pick<PageProps<"/account/vault/[number]">, "params">) {
  const entry = await getVaultEntry((await params).number);
  if (!entry) notFound();

  const order = entry.orders;
  // Read after the entry, so it's this request's time, not the build's.
  const now = new Date();
  const { expiresAt, warrantyEndsAt } = vaultDates(
    entry.delivered_at,
    order.duration_days,
    order.warranty_days,
    entry.expires_at,
  );
  const standing = vaultStanding(expiresAt, now, order.status);
  // The money went back, so the entry stays only as a record. The database
  // refuses the customer's reveal too; the page doesn't offer one.
  const refunded = standing === "refunded";
  const badge = vaultStandingBadge[standing];
  const help = whatsappLink(whatsappNumber(), `Hi, about my Kunji order #${order.number}`);
  const reportable =
    (order.status === "delivered" || order.status === "replaced") &&
    order.warranty_days > 0 &&
    warrantyRunning(warrantyEndsAt, now);
  const tickets = await vaultTicketState(entry.order_id);
  const reported = reportable && tickets.open;

  const details = [
    { term: "Plan", detail: formatDays(order.duration_days) },
    { term: "Delivered", detail: formatPakistanTime(entry.delivered_at) },
    {
      term: standing === "expired" ? "Expired" : "Expires",
      detail:
        standing === "expired"
          ? formatPakistanDate(expiresAt)
          : `${formatPakistanDate(expiresAt)} (${formatDays(daysLeft(expiresAt, now))} left)`,
    },
    {
      term: "Warranty",
      detail:
        order.warranty_days === 0
          ? formatWarranty(0)
          : `${warrantyEndsAt > now ? "Until" : "Ended"} ${formatPakistanDate(warrantyEndsAt)}`,
    },
  ];

  return (
    <>
      {/* A replace or refund shows without a reload. Heard through the order
          and its tickets, so the vault's ciphertext never goes over a socket. */}
      <LiveOrders orderId={entry.order_id} />
      <LiveTickets orderId={entry.order_id} />
      <Link href="/account#vault" className={`${textLinkClass} text-sm`}>
        Your vault
      </Link>

      <header className="mt-1">
        <h1 className="heading-title">{order.product_name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <StatusBadge tone={badge.tone} label={badge.label} />
          <Link href={`/account/orders/${order.number}`} className={`${textLinkClass} font-mono`}>
            Order #{order.number}
          </Link>
        </div>
      </header>

      {/* Above the credential, every time: what voids the warranty, in the
          seller's words. No words, no box; nothing is made up to fill it. */}
      {!refunded && entry.warranty_warning && (
        <section aria-labelledby="warning-heading" className="mt-6 rounded-lg border-2 border-foreground p-4">
          <h2 id="warning-heading" className="heading-section">
            What voids your warranty
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm">{entry.warranty_warning}</p>
        </section>
      )}

      <section aria-labelledby="credential-heading" className="mt-6 surface p-4">
        <h2 id="credential-heading" className="mb-3 heading-section">
          {credentialKindLabel[entry.kind]}
        </h2>
        {refunded ? (
          <p className="text-sm text-muted-foreground">
            This order was refunded, so this login is no longer valid and isn&apos;t shown.
          </p>
        ) : (
          // Keyed on the replace count: a login shown before a replace is
          // dropped, and the next tap fetches the new one.
          <RevealCredential key={tickets.replacements} reveal={revealCredential.bind(null, entry.order_id)} />
        )}
      </section>

      {!refunded && entry.setup_instructions && (
        <section aria-labelledby="setup-heading" className="mt-6">
          <h2 id="setup-heading" className="heading-section">
            Setting it up
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm">{entry.setup_instructions}</p>
        </section>
      )}

      <section aria-labelledby="details-heading" className="mt-6">
        <h2 id="details-heading" className="heading-section">
          Details
        </h2>
        <dl className="mt-2 surface divide-y divide-foreground/10 text-sm">
          {details.map(({ term, detail }) => (
            <div key={term} className="flex justify-between gap-3 px-4 py-2.5">
              <dt className="text-muted-foreground">{term}</dt>
              <dd className="min-w-0 text-right font-medium tabular-nums">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* The report and its thread live on the order; this only points there. */}
      <section aria-label="Problem with it?" className="mt-8">
        {refunded ? (
          <p className="text-sm">
            Refunded.{" "}
            <Link href={`/account/orders/${order.number}`} className={textLinkClass}>
              See the refund on your order
            </Link>
          </p>
        ) : reported ? (
          <p className="text-sm">
            You&apos;ve reported a problem.{" "}
            <Link href={`/account/orders/${order.number}#warranty-heading`} className={textLinkClass}>
              See where it is
            </Link>
          </p>
        ) : reportable ? (
          <Link href={`/account/orders/${order.number}/report`} className={primaryButtonClass}>
            Report a problem
          </Link>
        ) : (
          <p className="text-sm">
            {order.warranty_days === 0
              ? "This plan has no warranty."
              : `Warranty ended ${formatPakistanDate(warrantyEndsAt)}.`}{" "}
            Not working?{" "}
            <a href={help} className={textLinkClass}>
              Tell us on WhatsApp
            </a>
          </p>
        )}
      </section>
    </>
  );
}
