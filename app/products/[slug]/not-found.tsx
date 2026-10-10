import Link from "next/link";

// A hidden product and a mistyped link look the same to a customer, and
// neither is an error on their part.
export default function ProductNotAvailable() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">This product isn&apos;t available</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">
        It may have been taken off the store. Everything you can buy right now is listed there.
      </p>
      <Link
        href="/"
        className="mt-3 inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Browse the store
      </Link>
    </main>
  );
}
