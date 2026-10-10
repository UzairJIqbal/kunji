import { publicEnv } from "@/lib/env";

export const PRODUCT_IMAGE_BUCKET = "product-images";

// The bucket is public, so the URL is built rather than asked for.
export function productImageUrl(path: string): string {
  return new URL(
    `/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${path}`,
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
  ).toString();
}
