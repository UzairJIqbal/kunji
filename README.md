# Kunji

A store for digital subscriptions priced in Pakistani rupees, paid from a mobile wallet, with every login delivered to the customer's own encrypted vault.

**Live demo:** _coming soon_

## What it does

- Customers browse the catalogue without signing in. Every listing shows what you get, the duration, the warranty and how delivery works.
- Checkout takes Easypaisa, JazzCash, NayaPay, SadaPay or a bank transfer. The customer enters the transaction ID and uploads the receipt.
- The seller checks the payment in an admin queue and approves or rejects it, then buys the item from the supplier by hand.
- The seller pastes the login into the customer's vault. The order page updates live, with no refresh.
- Warranty tickets for replacements or refunds, reviews from customers whose order was delivered, and seller reports on sales, margin and wait times.
- The seller is notified of new payments by Web Push and email.

## Stack

Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4 and shadcn/ui. Clerk for sign-in. Supabase for Postgres, row-level security, Storage and Realtime, trusting Clerk's session token through Supabase's Clerk integration. Node's built-in crypto for the vault. Zod at every boundary. Web Push and Resend for seller notifications. pnpm.

## Security

- **Row-level security decides who sees what.** Every table has it switched on, and policies, not application code, decide which rows a user may read or write. Admin power is a row in the `admins` table, read by those policies. The app never uses Supabase's service key. `pnpm check:rls` fails if any table has row-level security off or if a customer can do something only the seller should.
- **Credentials are encrypted before they reach the database.** One module encrypts and decrypts vault entries with AES-256-GCM under `VAULT_KEY`. A login is never stored, logged or sent in plain text, and only the order's customer and the seller can open it.
- **The seller always approves payments.** Uploading a receipt only moves an order to "verifying". It becomes paid only when the seller approves it. Order status changes happen only in database functions that know which moves are allowed and record each one.
- Supplier prices, margins and supplier order details are admin-only, enforced by policy.

## Run it locally

You need Node 20+, pnpm, a Supabase project and a Clerk application (both free plans work).

1. Install: `pnpm install`
2. Copy `.env.example` to `.env.local` and fill in every value. Each one has a comment saying where it comes from. Make the vault key with `openssl rand -base64 32` and keep a copy in a password manager: if it's lost, nothing can decrypt the vault.
3. Connect Clerk to Supabase: turn on the Supabase integration in the Clerk dashboard, then add Clerk as a third-party auth provider in the Supabase dashboard (Authentication → Sign In / Providers → Third-party auth).
4. Apply the migrations in `supabase/migrations/` in order, e.g. with the Supabase CLI: `supabase link` then `supabase db push`.
5. Sign in to the app once, then make yourself the seller by adding your Clerk user ID to the `admins` table.
6. Start it: `pnpm dev`, then open http://localhost:3000.

Checks:

```bash
pnpm exec tsc --noEmit   # types
pnpm lint
pnpm test                # money, dates, status and crypto
pnpm build
pnpm check:rls           # row-level security, needs DATABASE_URL
```
