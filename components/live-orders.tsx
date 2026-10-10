"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { subscribeWithToken, useSupabase } from "@/lib/supabase/client";

// Re-reads the page whenever an order it shows changes. Realtime only sends
// changes to rows the viewer's policies let them read, and the page does the
// reading, so there's still one way the data arrives. Not filtered by status:
// an approved order no longer matches "verifying", and the queue has to hear
// about it to drop the row.
export function LiveOrders({ orderId }: { orderId?: string }) {
  const supabase = useSupabase();
  const router = useRouter();

  useEffect(
    () =>
      subscribeWithToken(supabase, () =>
        supabase.channel(orderId ? `order-${orderId}` : "orders").on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            ...(orderId ? { filter: `id=eq.${orderId}` } : {}),
          },
          () => router.refresh(),
        ),
      ),
    [supabase, router, orderId],
  );

  return null;
}
