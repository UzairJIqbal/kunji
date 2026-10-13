import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Create an account · Kunji" };

export default function SignUpPage() {
  return (
    <main className="flex flex-1 justify-center px-4 py-8">
      <Suspense>
        <SignUp />
      </Suspense>
    </main>
  );
}
