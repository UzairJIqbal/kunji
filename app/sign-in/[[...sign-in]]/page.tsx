import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Sign in · Kunji" };

// withSignUp: a first-time visitor gets an account from this same screen,
// whichever method they use, without being sent to a separate sign-up page.
export default function SignInPage() {
  return (
    <main className="flex flex-1 justify-center px-4 py-8">
      <Suspense>
        <SignIn withSignUp />
      </Suspense>
    </main>
  );
}
