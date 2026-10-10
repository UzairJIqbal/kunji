"use client";

import { useSession } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

// The browser twin of the server client: the Clerk token rides on every
// request, read fresh each time so an expired one is never sent.
export function useSupabase(): SupabaseClient<Database> {
  const { session } = useSession();

  return useMemo(
    () =>
      createClient<Database>(
        publicEnv.NEXT_PUBLIC_SUPABASE_URL,
        publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        { accessToken: async () => (await session?.getToken()) ?? null },
      ),
    [session],
  );
}
