import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

// The storefront reads as the public, whoever is signed in. The anon policies
// decide what a customer sees, and an admin browsing the store sees exactly
// that too: a hidden product is gone for them as well, and nothing admin-only
// can ride along. With no token, supabase-js sends the publishable key alone.
export function createPublicSupabase() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { accessToken: async () => null },
  );
}
