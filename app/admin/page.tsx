import type { Metadata } from "next";
import { Suspense } from "react";
import { getOrderStatusCounts } from "@/lib/data/orders";
import { adminStatusLabel } from "@/lib/order-status";

export const metadata: Metadata = { title: "Admin · Kunji" };

// Who counts as an admin is a row in the admins table; this page doesn't check,
// the database refuses the count to anyone else.
export default function AdminPage() {
  return (
    <main className="mt-3">
      <h1 className="text-sm font-semibold">Admin</h1>

      <section id="orders" aria-labelledby="orders-heading" className="mt-3">
        <h2 id="orders-heading" className="text-xs font-medium text-muted-foreground">
          Orders by state
        </h2>
        <Suspense fallback={<p className="mt-1.5 text-muted-foreground">Counting…</p>}>
          <StatusCounts />
        </Suspense>
      </section>
    </main>
  );
}

async function StatusCounts() {
  const result = await getOrderStatusCounts();

  if (!result.ok) {
    return (
      <p className="mt-1.5 rounded-md border border-dashed px-3 py-4 text-muted-foreground">
        This account isn&apos;t an admin.
      </p>
    );
  }

  const total = result.counts.reduce((sum, row) => sum + row.count, 0);

  return (
    <table className="mt-1.5 w-full max-w-xs border-collapse">
      <tbody>
        {result.counts.map((row) => (
          <tr key={row.status} className="border-b">
            <td className="py-0.5 pr-4">{adminStatusLabel[row.status]}</td>
            <td className="py-0.5 text-right font-mono tabular-nums">{row.count}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="font-semibold">
          <td className="py-0.5 pr-4">Total</td>
          <td className="py-0.5 text-right font-mono tabular-nums">{total}</td>
        </tr>
      </tfoot>
    </table>
  );
}
