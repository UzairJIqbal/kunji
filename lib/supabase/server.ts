import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

// Sessions belong to Clerk. Supabase never stores or refreshes its own session;
// every request carries the current Clerk token, and the policies read the
// Clerk user ID from it. Signed out, the token is null and the request is anon.
//
// auth() is awaited before the client exists: supabase-js asks for a token the
// moment it's constructed, and during prerender that request-time read must
// suspend the component rather than fire off on its own and reject.
export async function createServerSupabase() {
  const { getToken } = await auth();
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { accessToken: () => getToken() },
  );
}
