"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect } from "react";
import { useSupabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

declare global {
  interface Window {
    supabase?: SupabaseClient<Database>;
  }
}

// Development only: puts the app's own browser client on `window.supabase` so a
// query can be run from the console and its request headers inspected.
export function SupabaseConsole() {
  const client = useSupabase();
  useEffect(() => {
    window.supabase = client;
  }, [client]);
  return null;
}
