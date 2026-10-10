"use client";

import { useSession } from "@clerk/nextjs";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { tokenSecondsLeft } from "@/lib/token";

// Realtime asks for the token on every heartbeat, 25 seconds apart, and closes
// a channel for good the moment its token expires. Clerk's tokens live about a
// minute and its cache hands back one with seconds to spare, so a token that
// won't outlast the next heartbeat (plus slack for a slow network) is swapped
// for a fresh one.
const TOKEN_MIN_SECONDS = 30;

type ClerkSession = { getToken: (options?: { skipCache?: boolean }) => Promise<string | null> };

async function lastingToken(session: ClerkSession | null | undefined): Promise<string | null> {
  if (!session) return null;
  const token = await session.getToken();
  if (!token || tokenSecondsLeft(token, Date.now()) >= TOKEN_MIN_SECONDS) return token;
  return session.getToken({ skipCache: true });
}

// The browser twin of the server client: the Clerk token rides on every
// request, read fresh each time so an expired one is never sent.
export function useSupabase(): SupabaseClient<Database> {
  const { session } = useSession();

  return useMemo(
    () =>
      createClient<Database>(
        publicEnv.NEXT_PUBLIC_SUPABASE_URL,
        publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        { accessToken: () => lastingToken(session) },
      ),
    [session],
  );
}

// Realtime checks row-level security with the token a channel joined with,
// and the socket joins as soon as it opens, whether or not Clerk's token has
// arrived. A channel that wins that race is anonymous for good and hears no
// order changes. So the token is fetched first, then the channel joins.
// Returns the cleanup for an effect.
export function subscribeWithToken(
  supabase: SupabaseClient<Database>,
  makeChannel: () => RealtimeChannel,
): () => void {
  let channel: RealtimeChannel | null = null;
  let stopped = false;

  supabase.realtime
    .setAuth()
    .then(() => {
      if (stopped) return;
      channel = makeChannel().subscribe((status, error) => {
        // Silent failure here looks like a page that never updates.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`Live updates didn't start: ${status}${error ? ` ${error.message}` : ""}`);
        }
        // Closed by the server, not by leaving the page: nothing reopens it.
        if (status === "CLOSED" && !stopped) console.error("Live updates stopped: the server closed the channel");
      });
    })
    .catch(() => console.error("Live updates didn't start: no token"));

  return () => {
    stopped = true;
    if (channel) void supabase.removeChannel(channel);
  };
}
