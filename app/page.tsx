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
    <main className="mx-auto w-full max-w-5xl px-4 pt-10 pb-6 sm:pt-16">
      <h1 className="heading-display">Subscriptions, paid in rupees</h1>
      <p className="mt-3 max-w-prose text-muted-foreground">
        Pay from your mobile wallet. Your login arrives in a private vault that only you can
        open.{" "}
        <Link
          href="/how-it-works"
          className="text-link"
        >
          How it works
        </Link>
      </p>

      <Suspense fallback={<p className="mt-10 text-sm text-muted-foreground">Loading products…</p>}>
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
      <p className="empty-state mt-10">
        Nothing is listed yet. Check back soon.
      </p>
    );
  }

  const categories = [...new Set(products.map((p) => p.category))];
  const groups = groupByCategory(filterCatalogue(products, filter));
  const filtering = filter.query !== "" || filter.category !== "";

  return (
    <>
      <Form action="/" role="search" className="mt-8 flex max-w-xl gap-2">
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
          className="field h-11 flex-1 px-3 text-base"
        />
        {filter.category && <input type="hidden" name="category" value={filter.category} />}
        <button
          type="submit"
          className="btn-primary h-11 text-sm"
        >
          Search
        </button>
      </Form>

      {categories.length > 1 && (
        <nav aria-label="Categories" className="mt-4 flex flex-wrap gap-2">
          {["", ...categories].map((category) => {
            const current = category === filter.category;
            return (
              <Link
                key={category || "all"}
                href={browseHref({ query: filter.query, category })}
                aria-current={current ? "page" : undefined}
                className="chip h-10"
              >
                {category || "All"}
              </Link>
            );
          })}
        </nav>
      )}

      {groups.length === 0 ? (
        <div className="empty-state mt-8">
          <p>
            Nothing matches
            {filter.query && <> &ldquo;{filter.query}&rdquo;</>}
            {filter.category && <> in {filter.category}</>}.
          </p>
          <Link
            href="/"
            className="text-link mt-2 inline-flex min-h-11 items-center"
          >
            Show everything
          </Link>
        </div>
      ) : (
        groups.map((group, i) => (
          <section key={group.category} aria-labelledby={`category-${i}`} className="mt-10 sm:mt-14">
            <h2 id={`category-${i}`} className="heading-title">
              {group.category}
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          className="text-link mt-4 inline-flex min-h-11 items-center text-sm"
        >
          Show everything
        </Link>
      )}
    </>
  );
}
