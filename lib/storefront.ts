// What the storefront says about a product, worked out from its plans. Pure, so
// the tests can check every wording without a database.

import { formatDays } from "./format.ts";

// Delivery is the seller doing it by hand, so it's the same for every product.
// The card has room for the short form; the product page says it in full.
export const DELIVERY_SHORT = "Usually 30 min, 10am to midnight";
export const DELIVERY_SENTENCE =
  "Delivered to your vault by hand, usually within 30 minutes, 10am to midnight.";

// "New" is a fact about the listing: added in the last two weeks.
const NEW_FOR_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isNew(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() < NEW_FOR_DAYS * DAY_MS;
}

export type PricedPlan = { duration_days: number; warranty_days: number; sell_price: number };

export type PlanSummary = {
  lowestPrice: number;
  // Only says "from" when there's a cheaper and a dearer plan to choose between.
  pricesVary: boolean;
  duration: string;
  warranty: string;
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

// wa.me wants the number in international form, digits only.
export function whatsappLink(number: string): string {
  if (!/^\d+$/.test(number)) throw new Error("A WhatsApp number is digits only");
  return `https://wa.me/${number}`;
}
