import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Figtree, Geist_Mono, Newsreader } from "next/font/google";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { AwayBanner } from "@/components/store/away-banner";
import { SiteFooter } from "@/components/store/site-footer";
import { SupabaseConsole } from "@/components/supabase-console";
import { themeScript } from "@/components/theme-control";
import { getStoreSettings } from "@/lib/data/verification";
import "./globals.css";

// The design's two faces: a serif for headings, a clean sans for everything
// else. Upright only; nothing on Kunji is set in italic, so that file is skipped.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: "normal",
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

// Order numbers and transaction IDs, which the design doesn't show.

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kunji",
  description: "Digital subscriptions in Pakistani rupees",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The inline script sets data-theme before React hydrates, hence the warning opt-out.
    <html
      lang="en"
      className={`${newsreader.variable} ${figtree.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ClerkProvider>
          <SiteHeader />
          <Suspense fallback={null}>
            <Away />
          </Suspense>
          <div className="flex flex-1 flex-col">{children}</div>
          <SiteFooter />
          {process.env.NODE_ENV === "development" && <SupabaseConsole />}
        </ClerkProvider>
      </body>
    </html>
  );
}

// Read on every request, never baked into a build: the seller switches it on
// and off through the day.
async function Away() {
  await connection();
  return <AwayBanner initial={await getStoreSettings()} />;
}
