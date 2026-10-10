// A product's address on the storefront, made once from its name when it's
// created. Renaming a product later doesn't change it, so a shared link keeps
// working. Matches the slug check on the products table.
export function slugFromName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}
