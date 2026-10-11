"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { subscribeWithToken, useSupabase } from "@/lib/supabase/client";

// Re-reads the page when a ticket it shows changes or gets a message, as
// LiveOrders does for orders: Realtime only delivers rows the viewer's
// policies let them read, and the page does the reading. With an order, it
// hears that order's tickets open and close; with a ticket, that ticket's
// thread; with neither, every ticket, for the seller's list.
export function LiveTickets({ orderId, ticketId }: { orderId?: string; ticketId?: string }) {
  const supabase = useSupabase();
  const router = useRouter();

  useEffect(
    () =>
      subscribeWithToken(supabase, () => {
        const ticketFilter = ticketId
          ? { filter: `id=eq.${ticketId}` }
          : orderId
            ? { filter: `order_id=eq.${orderId}` }
            : {};
        const channel = supabase
          .channel(`tickets-${ticketId ?? orderId ?? "all"}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "warranty_tickets", ...ticketFilter },
            () => router.refresh(),
          );
        return ticketId
          ? channel.on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${ticketId}` },
              () => router.refresh(),
            )
          : channel;
      }),
    [supabase, router, orderId, ticketId],
  );

  return null;
}
