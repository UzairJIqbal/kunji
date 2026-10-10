import type { StatusTone } from "@/lib/order-status";

const toneClass: Record<StatusTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  plain: "text-muted-foreground",
};

export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return <span className={`font-medium ${toneClass[tone]}`}>{label}</span>;
}
