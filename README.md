# Kunji

A store for digital subscriptions priced in Pakistani rupees, paid from a mobile wallet, with every login delivered to the customer's own encrypted vault.

**Live:** https://kunji-two.vercel.app

| Storefront | Vault |
| --- | --- |
| ![The storefront on a phone](docs/screenshots/storefront.png) | ![A delivered login in the customer's vault](docs/screenshots/vault.png) |
| **Verification queue** | **Buy list** |
| ![The seller's payment verification queue](docs/screenshots/queue.png) | ![The seller's buy list](docs/screenshots/buy-list.png) |

## What makes it different

- **Honest listings.** Every product says what you actually get: the duration, the warranty, whether it's your own account or a shared one, and how it's delivered. No fake reviews, stock counts or countdowns. If the seller didn't write it, the store doesn't show it.
- **Statuses that are always true.** An order is never marked paid until the seller has checked the payment and approved it. Uploading a receipt only moves it to "verifying". Every status change goes through the database, which knows the allowed moves and records each one, and the customer's order page updates live.
- **An encrypted vault.** Logins are encrypted with AES-256-GCM before they reach the database and are only ever decrypted for that order's customer or the seller. A credential is never stored, logged or sent in plain text.

## How it works

1. A customer browses without signing in, picks a plan and checks out with Easypaisa, JazzCash, NayaPay, SadaPay or a bank transfer, entering the transaction ID and uploading the receipt.
2. The seller is notified by Web Push and email, checks the payment in the verification queue and approves or rejects it.
3. The seller buys the same item from the supplier by hand, records it on the buy list, and pastes the login into the customer's vault.
4. Warranty tickets handle replacements and pro-rata refunds. Customers whose order was delivered can leave a review. Reports show sales, margin and wait times.

## Architecture

- **Next.js App Router on the server.** Every database read and write happens in server code, as the signed-in user. The app never holds Supabase's service key.
- **Clerk signs people in; Supabase trusts Clerk's session token.** Row-level security policies on every table decide who may read or write each row. Admin power is a row in the `admins` table that those policies read, not a check in the app.
- **Database functions own every multi-row change.** Placing an order, submitting payment proof, approving, recording a purchase, delivering and replacing are each one Postgres function that checks the order's current status before moving it.
- **One module encrypts and decrypts credentials** with Node's built-in crypto, under a key that lives only in the server's environment.
- **Supabase Storage** holds receipts and product images behind the same policies. **Realtime** pushes order changes to the customer's page.
- **Pure functions for money and dates** (sell price, margin, expiry, warranty end, pro-rata refund), with tests.
- The full schema is the ordered migrations in `supabase/migrations/`. Applied to an empty database, they produce everything the app expects.

## Stack

Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4 and shadcn/ui. Clerk for sign-in. Supabase for Postgres, row-level security, Storage and Realtime, through Supabase's Clerk integration. Node's built-in crypto for the vault. Zod at every boundary. Web Push and Resend for seller notifications. pnpm. Deployed on Vercel.

## Run it locally

You need Node 24 (see `.nvmrc`), pnpm, a Supabase project and a Clerk application. Free plans of both work.

1. Install: `pnpm install`
2. Copy `.env.example` to `.env.local` and fill in every value. Each one has a comment saying where it comes from. Make the vault key with `openssl rand -base64 32` and keep a copy in a password manager: if it's lost, nothing can decrypt the vault. The app refuses to build or start if any value is missing or malformed.
3. Connect Clerk to Supabase: turn on the Supabase integration in the Clerk dashboard, then add Clerk as a third-party auth provider in the Supabase dashboard (Authentication → Sign In / Providers → Third-party auth).
4. Apply the migrations in `supabase/migrations/` in order with the Supabase CLI: `supabase link`, then `supabase db push`.
5. Sign in to the app once, then make yourself the seller by adding your Clerk user ID to the `admins` table.
6. Start it: `pnpm dev`, then open http://localhost:3000.

Checks, all run by CI on every pull request:

```bash
pnpm exec tsc --noEmit   # types
pnpm lint
pnpm test                # money, dates, statuses and crypto
pnpm build
pnpm check:rls           # row-level security, against DATABASE_URL
```

`pnpm check:rls` creates its own throwaway admin, product and orders inside a transaction and rolls everything back, so it works against an empty database and leaves nothing behind. CI runs it against a fresh local database (`supabase db start`) built from the migrations alone.

## Free-plan limits

Everything runs on free plans. Each has a limit worth knowing:

- **Vercel Hobby is for non-commercial use only.** It's fine for testing and showing the project. Before the first real customer pays, the store moves to Vercel Pro or to a host whose free plan allows commercial use, such as Netlify. Nothing in the code depends on a Vercel-only feature, so the move is configuration, not a rewrite.
- **Supabase's free plan pauses a project after a week with no activity.** A store with customers won't hit this; a demo left alone will, and has to be restored from the Supabase dashboard.
- **Clerk runs on its development instance.** A production instance needs a domain you own, and the live site uses the free `vercel.app` address, so the small "Development mode" banner Clerk shows is expected.
- **Resend's free plan without a verified domain only delivers to the account's own address**, which is why seller emails go to `SELLER_EMAIL`, the address the Resend account was made with.

## Licence

MIT. See [LICENSE](LICENSE).
