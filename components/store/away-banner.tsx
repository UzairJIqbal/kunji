"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { subscribeWithToken, useSupabase } from "@/lib/supabase/client";
import { awayMessage } from "@/lib/verification";

type StoreSettings = { away: boolean; back_at: string | null };

const settingsSchema = z.object({ away: z.boolean(), back_at: z.string().nullable() });

// Starts from what the server read, then follows the setting live: when the
// seller switches away off, the banner goes from every open page at once.
export function AwayBanner({ initial }: { initial: StoreSettings }) {
  const supabase = useSupabase();
  const [settings, setSettings] = useState(initial);
  // A fresh server read (a refresh, a navigation) wins over what was heard.
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setSettings(initial);
  }

  useEffect(
    () =>
      subscribeWithToken(supabase, () =>
        supabase
          .channel("store-settings")
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "store_settings" }, (payload) => {
            const next = settingsSchema.safeParse(payload.new);
            if (next.success) setSettings(next.data);
          }),
      ),
    [supabase],
  );

  if (!settings.away || !settings.back_at) return null;
  return (
    <p role="status" className="border-b bg-muted px-4 py-2 text-center text-sm font-medium text-warning">
      {awayMessage(settings.back_at)}
    </p>
  );
}
