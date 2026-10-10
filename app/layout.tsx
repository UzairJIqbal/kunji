import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SupabaseConsole } from "@/components/supabase-console";
import { themeScript } from "@/components/theme-control";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ClerkProvider>
          <SiteHeader />
          <div className="flex flex-1 flex-col">{children}</div>
          {process.env.NODE_ENV === "development" && <SupabaseConsole />}
        </ClerkProvider>
      </body>
    </html>
  );
}
