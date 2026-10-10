import { getReceiptPath } from "@/lib/data/orders";
import { RECEIPT_BUCKET } from "@/lib/checkout";
import { createServerSupabase } from "@/lib/supabase/server";

// The receipt is fetched with the viewer's own token, so the storage policy
// decides: the customer who uploaded it, or an admin. Anyone else finds no
// order, and gets the same 404 as for an order that doesn't exist.
export async function GET(_request: Request, ctx: RouteContext<"/account/orders/[number]/receipt">) {
  const { number } = await ctx.params;
  const path = await getReceiptPath(number);
  if (!path) return new Response("Not found", { status: 404 });

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).download(path);
  if (error || !data) return new Response("Not found", { status: 404 });

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      // Proof of a payment: never kept by a shared cache or the browser's.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
