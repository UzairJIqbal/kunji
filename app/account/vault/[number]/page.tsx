import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StatusBadge } from "@/components/status-badge";
import { textLinkClass } from "@/components/store/fields";
import { RevealCredential } from "@/components/vault/reveal-credential";
import { revealCredential } from "@/lib/actions/vault";
import { getVaultEntry } from "@/lib/data/vault";
import { whatsappNumber } from "@/lib/env";
import { formatDays, formatPakistanDate, formatPakistanTime, formatWarranty } from "@/lib/format";
import { whatsappLink } from "@/lib/storefront";
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
  const { expiresAt, warrantyEndsAt } = vaultDates(entry.delivered_at, order.duration_days, order.warranty_days);
  const standing = vaultStanding(expiresAt, now);
  const badge = vaultStandingBadge[standing];
  const help = whatsappLink(whatsappNumber(), `Hi, about my Kunji order #${order.number}`);

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
      <Link href="/account#vault" className={`${textLinkClass} text-sm`}>
        Your vault
      </Link>

      <header className="mt-1">
        <h1 className="text-2xl font-semibold leading-snug tracking-tight">{order.product_name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <StatusBadge tone={badge.tone} label={badge.label} />
          <Link href={`/account/orders/${order.number}`} className={`${textLinkClass} font-mono`}>
            Order #{order.number}
          </Link>
        </div>
      </header>

      {/* Above the credential, every time: what voids the warranty, in the
          seller's words. No words, no box; nothing is made up to fill it. */}
      {entry.warranty_warning && (
        <section aria-labelledby="warning-heading" className="mt-6 rounded-lg border-2 border-foreground p-4">
          <h2 id="warning-heading" className="text-base font-semibold">
            What voids your warranty
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm">{entry.warranty_warning}</p>
        </section>
      )}

      <section aria-labelledby="credential-heading" className="mt-6 rounded-lg border bg-card p-4">
        <h2 id="credential-heading" className="mb-3 text-base font-semibold">
          {credentialKindLabel[entry.kind]}
        </h2>
        <RevealCredential reveal={revealCredential.bind(null, entry.order_id)} />
      </section>

      {entry.setup_instructions && (
        <section aria-labelledby="setup-heading" className="mt-6">
          <h2 id="setup-heading" className="text-base font-semibold">
            Setting it up
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm">{entry.setup_instructions}</p>
        </section>
      )}

      <section aria-labelledby="details-heading" className="mt-6">
        <h2 id="details-heading" className="text-base font-semibold">
          Details
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

      <p className="mt-8 text-sm">
        Not working?{" "}
        <a href={help} className={textLinkClass}>
          Tell us on WhatsApp
        </a>
      </p>
    </>
  );
}
