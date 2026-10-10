import type { NextConfig } from "next";
import { assertServerEnv, publicEnv } from "./lib/env";

assertServerEnv();

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
