import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { ThemeControl } from "@/components/theme-control";

// One line at 360px: name on the left, everything else packed right.
export function SiteHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-4">
        <Link
          href="/"
          className="mr-auto rounded-sm text-[17px] font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Kunji
        </Link>
        <ThemeControl />
        <Link
          href="/account"
          className="inline-flex h-9 items-center rounded-md px-2.5 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Account
        </Link>
        {/* Auth state is per request, so it streams in; the rest of the header is static. */}
        <Suspense fallback={<div className="size-9" />}>
          <Show when="signed-out">
            <SignInButton>
              <button
                type="button"
                className="ml-1 inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
