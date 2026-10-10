// What a plan sells for and how big its margin really is. The database works
// out the stored sell price the same way (a trigger on the supplier details);
// these are for showing it while the seller types and in the lists.

// Below this share of the sell price, a margin is shown in amber. It never
// stops a save: the margin is the seller's choice.
const THIN_MARGIN_PERCENT = 10;

// The seller is meant to look at numastore at least weekly.
const STALE_AFTER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function assertWholeRupees(amount: number, what: string): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`${what} must be whole rupees, got ${amount}`);
  }
}

export function sellPrice(supplierPrice: number, margin: number): number {
  assertWholeRupees(supplierPrice, "Supplier price");
  assertWholeRupees(margin, "Margin");
  return supplierPrice + margin;
}

// The margin as a share of what the customer pays, rounded down so a margin
// just under the line never reads as if it were on it.
export function marginPercent(supplierPrice: number, margin: number): number {
  const sell = sellPrice(supplierPrice, margin);
  if (sell === 0) return 0;
  return Math.floor((margin * 100) / sell);
}

// Compared exactly in integers, not on the rounded percentage.
export function isThinMargin(supplierPrice: number, margin: number): boolean {
  return margin * 100 < sellPrice(supplierPrice, margin) * THIN_MARGIN_PERCENT;
}

// Whole days since, counting a part day as none: checked 23 hours ago is today.
export function daysSince(then: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / DAY_MS));
}

// More than a week since the seller last looked at the supplier's price.
export function isPriceCheckStale(checkedAt: Date, now: Date): boolean {
  return now.getTime() - checkedAt.getTime() > STALE_AFTER_DAYS * DAY_MS;
}
