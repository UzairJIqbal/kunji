import type { StatusTone } from "@/lib/order-status";

// A faint wash of the status colour behind its label: the label carries the
// meaning, the wash only makes it findable in a list. Kept at /10 so the
// coloured text still clears AA on both the page and a card.
const toneClass: Record<StatusTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  plain: "bg-secondary text-muted-foreground",
};

export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className={`inline-block rounded-sm px-1.5 py-px text-[0.8125em] font-medium leading-snug ${toneClass[tone]}`}>
      {label}
    </span>
  );
}
