// The storefront. Public: nothing here reads the session.
export default function StorePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Kunji</h1>
      <p className="mt-1 max-w-prose text-muted-foreground">
        Digital subscriptions, paid in rupees from your mobile wallet.
      </p>

      <section aria-labelledby="products" className="mt-8">
        <h2 id="products" className="text-sm font-medium text-muted-foreground">
          Products
        </h2>
        <p className="mt-3 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Nothing is listed yet.
        </p>
      </section>
    </main>
  );
}
