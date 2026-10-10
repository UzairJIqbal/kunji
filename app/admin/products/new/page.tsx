import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NotAdmin } from "@/components/admin/not-admin";
import { ProductForm, blankProduct } from "@/components/admin/product-form";
import { createProduct } from "@/lib/actions/catalogue";
import { viewerSeesAdminRows } from "@/lib/data/admin";
import { listCategories } from "@/lib/data/catalogue";

export const metadata: Metadata = { title: "New product · Admin · Kunji" };

export default function NewProductPage() {
  return (
    <main className="mt-3 max-w-2xl">
      <Link
        href="/admin/products"
        className="rounded-sm text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Products
      </Link>
      <h1 className="mt-1 text-sm font-semibold">New product</h1>
      <p className="mt-0.5 text-muted-foreground">
        It starts hidden. Add its plans on the next page, then show it.
      </p>
      <Suspense fallback={<p className="mt-3 text-muted-foreground">Loading…</p>}>
        <NewProduct />
      </Suspense>
    </main>
  );
}

async function NewProduct() {
  const [isAdmin, categories] = await Promise.all([viewerSeesAdminRows(), listCategories()]);
  if (!isAdmin) return <NotAdmin />;
  return (
    <div className="mt-3">
      <ProductForm
        action={createProduct}
        initial={blankProduct}
        categories={categories}
        imageUrl={null}
        submitLabel="Create product"
      />
    </div>
  );
}
