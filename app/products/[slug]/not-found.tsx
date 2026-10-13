import Link from "next/link";

// A hidden product and a mistyped link look the same to a customer, and
// neither is an error on their part.
export default function ProductNotAvailable() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="heading-title">This product isn&apos;t available</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">
        It may have been taken off the store. Everything you can buy right now is listed there.
      </p>
      <Link
        href="/"
        className="btn-primary mt-4 h-11 text-sm"
      >
        Browse the store
      </Link>
    </main>
  );
}
