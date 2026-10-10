import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything else is the storefront and stays public. A signed-out visitor to
// these is redirected before any page code runs, with the URL they wanted kept
// so Clerk sends them back to it after signing in.
const isProtected = createRouteMatcher(["/account(.*)", "/admin(.*)", "/checkout(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
