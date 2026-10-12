import { getOrdersReport } from "@/lib/data/reports";
import { formatDays, formatPakistanTime } from "@/lib/format";
import { adminStatusLabel } from "@/lib/order-status";
import { periodRange, reportPeriodSchema, toCsv } from "@/lib/reports";

// The period's orders as a spreadsheet. Read with the seller's own session, so
// the report function's admin check decides; there is no credential, email or
// phone number in what it returns to begin with.
export async function GET(request: Request) {
  const parsed = reportPeriodSchema.safeParse(new URL(request.url).searchParams.get("period") ?? undefined);
  if (!parsed.success) return new Response("Unknown period", { status: 400 });
  const period = parsed.data;

  const now = new Date();
  const report = await getOrdersReport(periodRange(period, now));
  if (!report.ok) return new Response("Not found", { status: 404 });

  const csv = toCsv(
    ["Order", "Placed (Pakistan time)", "Product", "Plan", "Price", "numastore cost", "Refund", "Replacement cost", "Status"],
    report.rows.map((o) => [
      o.number,
      formatPakistanTime(o.placed_at),
      o.product_name,
      formatDays(o.duration_days),
      o.price,
      o.supplier_cost,
      o.refund,
      o.replacement_cost,
      adminStatusLabel[o.status],
    ]),
  );

  const stamp = now.toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kunji-orders-${period}-${stamp}.csv"`,
      // Money figures for the seller only: never kept by a shared cache.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
