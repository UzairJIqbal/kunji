import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignUpPage() {
  return (
    <main className="flex flex-1 justify-center px-4 py-8">
      <Suspense>
        <SignUp />
      </Suspense>
    </main>
  );
}
