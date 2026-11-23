import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

// The storefront is open to every crawler. Anything behind a sign-in, and the
// sign-in pages themselves, is not: there's nothing there a crawler should
// see, and the proxy would only redirect it anyway.
export default function robots(): MetadataRoute.Robots {
  const url = siteUrl().replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/admin", "/checkout", "/sign-in", "/sign-up", "/api", "/__clerk"],
    },
    sitemap: `${url}/sitemap.xml`,
  };
}
