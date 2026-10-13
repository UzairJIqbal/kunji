import Link from "next/link";

const linkClass =
  "rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// A dense working tool, not a storefront: small type, tight rows.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 text-[13px] leading-5">
      <nav aria-label="Admin" className="flex flex-wrap gap-x-4 gap-y-1 border-b pb-2">
        <Link href="/admin" className={linkClass}>
          Orders
        </Link>
        <Link href="/admin/tickets" className={linkClass}>
          Tickets
        </Link>
        <Link href="/admin/reviews" className={linkClass}>
          Reviews
        </Link>
        <Link href="/admin/products" className={linkClass}>
          Products
        </Link>
        <Link href="/admin/stock" className={linkClass}>
          Stock
        </Link>
        <Link href="/admin/payment-accounts" className={linkClass}>
          Payment accounts
        </Link>
        <Link href="/admin/reports" className={linkClass}>
          Reports
        </Link>
        <Link href="/admin/notifications" className={linkClass}>
          Notifications
        </Link>
      </nav>
      {children}
    </div>
  );
}
