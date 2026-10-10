import "server-only";

import { z } from "zod";
import { ntfyEnv } from "@/lib/env";

const ntfyError = z.object({ error: z.string() });
const causeCode = z.object({ code: z.string() });

// Tells the seller's phone something happened, with one POST to the ntfy
// server. Never throws and never holds up the customer: it runs after the
// response, and a failure is a log line, since the queue is the source of
// truth. The topic is the secret, so it goes in the body (JSON publishing),
// and neither the request nor a raw error message is ever logged.
export async function pingSeller(ping: { title: string; message: string; click: string }): Promise<void> {
  const { url, topic } = ntfyEnv();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, ...ping }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      const body = ntfyError.safeParse(await response.json().catch(() => null));
      console.error(`ntfy ping failed: ${response.status} ${body.success ? body.data.error : "no reason given"}`);
    }
  } catch (error) {
    // The name (TimeoutError, TypeError) and the network code (ENOTFOUND) say
    // what went wrong without the message's text.
    const name = error instanceof Error ? error.name : "unknown error";
    const cause = error instanceof Error ? causeCode.safeParse(error.cause) : null;
    console.error(`ntfy ping failed: ${name}${cause?.success ? ` ${cause.data.code}` : ""}`);
  }
}
