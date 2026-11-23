import type { MetadataRoute } from "next";
import { listProductSlugs } from "@/lib/data/storefront";
import { siteUrl } from "@/lib/env";

// Public pages only: the storefront, its two policy pages, and every listed
// product. Read per request, so a product the seller adds is in it at once.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = siteUrl().replace(/\/$/, "");
  const slugs = await listProductSlugs();
  return [
    { url: `${url}/` },
    { url: `${url}/how-it-works` },
    { url: `${url}/warranty` },
    ...slugs.map((slug) => ({ url: `${url}/products/${slug}` })),
  ];
}
