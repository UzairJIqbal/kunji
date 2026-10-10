import Link from "next/link";
import { whatsappNumber } from "@/lib/env";
import { whatsappLink } from "@/lib/storefront";

const link =
  "inline-flex min-h-11 items-center rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// A way to a human from every page, before anyone has an order to ask about.
export function SiteFooter() {
  return (
    <footer className="mt-12 border-t">
      <div className="mx-auto max-w-3xl px-4 py-4 text-sm">
        <p className="text-muted-foreground">
          Questions before you buy?{" "}
          <a href={whatsappLink(whatsappNumber())} className={link} rel="noopener">
            Message us on WhatsApp
          </a>
        </p>
        <nav aria-label="Store policies" className="mt-1 flex flex-wrap gap-x-5">
          <Link href="/how-it-works" className={link}>
            How it works
          </Link>
          <Link href="/warranty" className={link}>
            Warranty and refunds
          </Link>
        </nav>
      </div>
    </footer>
  );
}
