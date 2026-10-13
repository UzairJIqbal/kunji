import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Suspense } from "react";
import { ThemeControl } from "@/components/theme-control";
import { viewerSeesAdminRows } from "@/lib/data/admin";

const navLinkClass =
  "inline-flex h-9 items-center rounded-md px-2.5 text-sm font-medium hover:bg-muted focus-ring";

// The design's floating white bar. One line at 360px: name on the left,
// everything else packed right.
export function SiteHeader() {
  return (
    <header className="px-2 pt-2 sm:px-4 sm:pt-4">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 rounded-md bg-raised px-3 shadow-raised sm:px-5">
        <Link
          href="/"
          className="mr-auto rounded-sm font-heading text-2xl leading-none focus-ring"
        >
          Kunji
        </Link>
        <ThemeControl />
        <Suspense fallback={null}>
          <AdminLink />
        </Suspense>
        <Link href="/account" className={navLinkClass}>
          Account
        </Link>
        {/* Auth state is per request, so it streams in; the rest of the header is static. */}
        <Suspense fallback={<div className="size-9" />}>
          <Show when="signed-out">
            <SignInButton>
              <button
                type="button"
                className="btn-primary ml-1 h-9 px-3 text-sm"
              >
                Sign in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <div className="ml-1 flex size-9 items-center justify-center">
              <UserButton />
            </div>
          </Show>
        </Suspense>
      </div>
    </header>
  );
}

// Shown when the admins policy lets this viewer see admin rows, which only an
// admin can. Signed out there's no one to ask about, and the anon role can't
// read the admins table at all, so the query is skipped.
async function AdminLink() {
  const { userId } = await auth();
  if (!userId || !(await viewerSeesAdminRows())) return null;
  return (
    <Link href="/admin/products" className={navLinkClass}>
      Admin
    </Link>
  );
}
