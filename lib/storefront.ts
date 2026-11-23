// What the storefront says about a product, worked out from its plans. Pure, so
// the tests can check every wording without a database.

import { formatDays } from "./format.ts";

// Delivery is the seller doing it by hand, so it's the same for every product.
// The card has room for the short form; the product page says it in full.
export const DELIVERY_SHORT = "Usually 30 min, 10am to midnight";
export const DELIVERY_SENTENCE =
  "Delivered to your vault by hand, usually within 30 minutes, 10am to midnight.";

// A plan with a login already bought and waiting is delivered in the same tap
// that approves the payment. Said only when every plan in view has one, so it
// never promises more than the plan the customer picks.
export const INSTANT_SHORT = "Instant delivery, 10am to midnight";
export const INSTANT_SENTENCE =
  "Delivered to your vault the moment your payment is approved, 10am to midnight.";

export function deliveryShort(instant: boolean): string {
  return instant ? INSTANT_SHORT : DELIVERY_SHORT;
}

export function deliverySentence(instant: boolean): string {
  return instant ? INSTANT_SENTENCE : DELIVERY_SENTENCE;
}

// "New" is a fact about the listing: added in the last two weeks.
const NEW_FOR_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isNew(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() < NEW_FOR_DAYS * DAY_MS;
}

// `instant_until` is when the stocked login that runs out first stops working:
// null when the plan has none free and is bought by hand after payment.
export type PricedPlan = {
  duration_days: number;
  warranty_days: number;
  sell_price: number;
  instant_until?: string | null;
};

export type PlanSummary = {
  lowestPrice: number;
  // Only says "from" when there's a cheaper and a dearer plan to choose between.
  pricesVary: boolean;
  duration: string;
  warranty: string;
  instant: boolean;
};

// Null when there's nothing to sum up: a product with no priced plan has no
// price to show, so it isn't listed.
export function summarisePlans(plans: readonly PricedPlan[]): PlanSummary | null {
  if (plans.length === 0) return null;
  const prices = plans.map((p) => p.sell_price);
  const durations = plans.map((p) => p.duration_days);
  const warranties = plans.map((p) => p.warranty_days);
  return {
    lowestPrice: Math.min(...prices),
    pricesVary: Math.min(...prices) !== Math.max(...prices),
    duration: dayRange(Math.min(...durations), Math.max(...durations)),
    warranty: warrantyRange(Math.min(...warranties), Math.max(...warranties)),
    instant: plans.every((p) => Boolean(p.instant_until)),
  };
}

export function dayRange(min: number, max: number): string {
  return min === max ? formatDays(min) : `${min}–${formatDays(max)}`;
}

// Zero is a real answer, not a gap: some plans carry no warranty at all, and
// "0–30 days" would read as a typo.
export function warrantyRange(min: number, max: number): string {
  if (max === 0) return "None";
  if (min === 0) return `Up to ${formatDays(max)}`;
  return dayRange(min, max);
}

// ───────────────────────────── Browsing ─────────────────────────────

type Browsable = { name: string; category: string };

export type CatalogueFilter = { query: string; category: string };

// Search is by name, ignoring case and spacing, so "chat gpt" and "ChatGPT"
// both find it.
function squash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

export function filterCatalogue<T extends Browsable>(
  products: readonly T[],
  { query, category }: CatalogueFilter,
): T[] {
  const needle = squash(query);
  return products.filter(
    (p) => (category === "" || p.category === category) && squash(p.name).includes(needle),
  );
}

// Groups keep the order the products arrived in, so sorting stays the query's job.
export function groupByCategory<T extends Browsable>(
  products: readonly T[],
): { category: string; products: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const product of products) {
    const group = groups.get(product.category);
    if (group) group.push(product);
    else groups.set(product.category, [product]);
  }
  return [...groups].map(([category, items]) => ({ category, products: items }));
}

// ───────────────────────────── WhatsApp ─────────────────────────────

// wa.me wants the number in international form, digits only. The text, when
// there is one, is typed into the chat ready to send.
export function whatsappLink(number: string, text?: string): string {
  if (!/^\d+$/.test(number)) throw new Error("A WhatsApp number is digits only");
  const link = `https://wa.me/${number}`;
  return text ? `${link}?text=${encodeURIComponent(text)}` : link;
}

// ───────────────────────── How it works, and questions ─────────────────────────

// A real sequence, so it's numbered. Every step here is something the store
// actually does; nothing is promised that the order page can't show. Shown on
// the home page and on /how-it-works, so the two never drift apart.
export const HOW_IT_WORKS_STEPS = [
  {
    title: "Choose a plan",
    body: "Every product page says exactly what you get: your own account, a shared slot, or an invite to your email, with its duration and warranty.",
  },
  {
    title: "Pay from your wallet",
    body: "Send the exact amount to the account shown at checkout. Then enter the transaction ID and the number you paid from, and upload the receipt.",
  },
  {
    title: "We check your payment",
    body: "A person checks the money has arrived before your order counts as paid. A screenshot alone never does it. Your order page shows where it's up to.",
  },
  {
    title: "Open your vault",
    body: `${DELIVERY_SENTENCE} Your login is kept there, encrypted, with setup instructions and the date it runs out.`,
  },
] as const;

export type Question = { question: string; answer: string };

// The home page's questions, built once so the visible answers and the
// FAQPage structured data are the same words. Payment methods are passed in
// from the seller's active accounts, so the answer never names one nobody can
// pay into.
export function storeQuestions(methodLabels: readonly string[]): Question[] {
  const methods =
    methodLabels.length > 0
      ? `Right now you can pay with ${new Intl.ListFormat("en-GB", { type: "disjunction" }).format(methodLabels)}.`
      : "No payment methods are open right now, so message us on WhatsApp before you order.";
  return [
    {
      question: "How do I pay?",
      answer: `In rupees, from your mobile wallet or bank account. ${methods} Send the exact amount to the account shown at checkout, then enter the transaction ID and upload the receipt.`,
    },
    {
      question: "How long does delivery take?",
      answer:
        "Usually within 30 minutes, between 10am and midnight, once a person has checked your payment. Some plans have a login already waiting and arrive the moment your payment is approved; their product page says so.",
    },
    {
      question: "What is the vault?",
      answer:
        "A private page in your Kunji account where your login is kept, encrypted, with its setup instructions and the date it runs out. Only you can open it, after signing in.",
    },
    {
      question: "Can I get a refund?",
      answer:
        "If we can't supply what you paid for, you get all of it back, and if you sent the wrong amount we send it back. If something stops working during its warranty and can't be replaced, we refund the part you haven't used. Refunds go to the wallet number you paid from.",
    },
  ];
}
