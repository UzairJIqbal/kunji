import Link from "next/link";
import { whatsappNumber } from "@/lib/env";
import { whatsappLink } from "@/lib/storefront";

const link =
  "inline-flex min-h-11 items-center rounded-sm font-medium text-footer-foreground underline decoration-footer-muted decoration-1 underline-offset-4 hover:decoration-footer-foreground focus-ring";

// A way to a human from every page, before anyone has an order to ask about.
export function SiteFooter() {
  return (
    // The design's charcoal footer, the same in either theme.
    <footer className="mt-16 bg-footer text-footer-foreground [--ring:var(--footer-foreground)]">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm">
        <p className="text-footer-muted">
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
