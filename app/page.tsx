import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { ProductCard } from "@/components/store/product-card";
import { listCatalogue } from "@/lib/data/storefront";
import {
  filterCatalogue,
  groupByCategory,
  isNew,
  summarisePlans,
  type CatalogueFilter,
} from "@/lib/storefront";

// The storefront. Public: nothing here reads the session.

// Search and category live in the address, so a filtered list can be shared
// and works before any JavaScript arrives. Anything odd falls back to blank.
const browseSchema = z.object({
  q: z.string().trim().max(80).catch(""),
  category: z.string().trim().max(60).catch(""),
});

export default function StorePage({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Subscriptions, paid in rupees</h1>
      <p className="mt-1 max-w-prose text-muted-foreground">
        Pay from your mobile wallet. Your login arrives in a private vault that only you can
        open.{" "}
        <Link
          href="/how-it-works"
          className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          How it works
        </Link>
      </p>

      <Suspense fallback={<p className="mt-6 text-sm text-muted-foreground">Loading products…</p>}>
        <Catalogue searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function browseHref({ query, category }: CatalogueFilter): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("category", category);
  const search = params.toString();
  return search ? `/?${search}` : "/";
}

const chip =
  "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

async function Catalogue({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const parsed = browseSchema.parse(await searchParams);
  const filter: CatalogueFilter = { query: parsed.q, category: parsed.category };
  const rows = await listCatalogue();
  // Read after the data, so "new" is judged at the time of this request.
  const now = new Date();

  const products = rows.flatMap((row) => {
    const summary = summarisePlans(row.plans);
    if (!summary) return [];
    return [{ ...row, summary, isNew: isNew(new Date(row.created_at), now) }];
  });

  if (products.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        Nothing is listed yet. Check back soon.
      </p>
    );
  }

  const categories = [...new Set(products.map((p) => p.category))];
  const groups = groupByCategory(filterCatalogue(products, filter));
  const filtering = filter.query !== "" || filter.category !== "";

  return (
    <>
      <Form action="/" role="search" className="mt-5 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search products
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={filter.query}
          placeholder="Search products"
          maxLength={80}
          className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
        />
        {filter.category && <input type="hidden" name="category" value={filter.category} />}
        <button
          type="submit"
          className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Search
        </button>
      </Form>

      {categories.length > 1 && (
        <nav aria-label="Categories" className="mt-3 flex flex-wrap gap-2">
          {["", ...categories].map((category) => {
            const current = category === filter.category;
            return (
              <Link
                key={category || "all"}
                href={browseHref({ query: filter.query, category })}
                aria-current={current ? "page" : undefined}
                className={`${chip} ${current ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              >
                {category || "All"}
              </Link>
            );
          })}
        </nav>
      )}

      {groups.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          <p>
            Nothing matches
            {filter.query && <> &ldquo;{filter.query}&rdquo;</>}
            {filter.category && <> in {filter.category}</>}.
          </p>
          <Link
            href="/"
            className="mt-2 inline-flex min-h-11 items-center rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Show everything
          </Link>
        </div>
      ) : (
        groups.map((group, i) => (
          <section key={group.category} aria-labelledby={`category-${i}`} className="mt-6">
            <h2 id={`category-${i}`} className="text-base font-semibold">
              {group.category}
            </h2>
            <ul className="mt-2 grid gap-3 sm:grid-cols-2">
              {group.products.map((product) => (
                <li key={product.slug}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {filtering && groups.length > 0 && (
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Show everything
        </Link>
      )}
    </>
  );
}
