import { z } from "zod";

const claims = z.object({ exp: z.number() });

// Seconds until a JWT expires, read from its own exp claim. Not a check of the
// signature: the browser only uses this to decide when to ask for a new one.
// Anything unreadable counts as already expired, so it gets replaced.
export function tokenSecondsLeft(token: string, nowMs: number): number {
  const payload = token.split(".")[1];
  if (!payload) return 0;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = claims.safeParse(JSON.parse(json));
    return parsed.success ? Math.max(0, parsed.data.exp - Math.floor(nowMs / 1000)) : 0;
  } catch {
    return 0;
  }
}
