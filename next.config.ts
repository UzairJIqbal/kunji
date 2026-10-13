import type { NextConfig } from "next";
import { assertServerEnv, publicEnv } from "./lib/env";

assertServerEnv();

// Clerk's frontend API host is encoded in the publishable key: base64 of the
// host followed by "$". Reading it from the key keeps the policy right when
// the instance changes, with nothing else to update.
const clerkHost = Buffer.from(publicEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.replace(/^pk_(test|live)_/, ""), "base64")
  .toString("utf8")
  .replace(/\$$/, "");
const supabase = new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL);
const isDev = process.env.NODE_ENV === "development";

// Only what the browser really loads: this site, Clerk (its script, API,
// avatars, telemetry and the Cloudflare check on sign-up), and the Supabase
// project (data, Realtime's socket, signed receipt images). Inline scripts
// and styles are allowed rather than nonced: a nonce makes every page render
// per request, and the store's static shell is what keeps it quick on a phone.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://${clerkHost} https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://img.clerk.com ${supabase.origin}`,
  "font-src 'self'",
  `connect-src 'self' https://${clerkHost} https://clerk-telemetry.com ${supabase.origin} wss://${supabase.host}`,
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    // A payment receipt may be up to 5 MB (its bucket's limit) and arrives
    // with the rest of the form, so the default 1 MB body would refuse it.
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Product images come only from this project's public bucket.
  images: {
    remotePatterns: [
      new URL("/storage/v1/object/public/product-images/**", publicEnv.NEXT_PUBLIC_SUPABASE_URL),
    ],
  },
  // Every response carries the security headers. The service worker is
  // always fetched fresh, so a change to it reaches the seller's browsers on
  // their next visit rather than whenever a cache expires.
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
