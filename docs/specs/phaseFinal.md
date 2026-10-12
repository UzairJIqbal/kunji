# Phase Final — Ship it

## Goal

Kunji is live at a free address, a customer can open the link from Instagram, understand the store in ten seconds and buy something, and the GitHub repository looks like a product someone maintains.

## Where this starts

Every phase is built and has passed its check locally. This phase adds nothing to what Kunji does. It's about making sure what exists is on GitHub, runs in production the same way it runs locally, and presents itself well to someone seeing it for the first time.

## Build

### Confirm GitHub is complete

- The default branch has every phase merged. No open pull requests from a finished phase, no unpushed commits, no work on a stray branch.
- A clean clone installs, builds, type-checks and passes its tests following only the README.
- No secret has ever been committed. Check the full history, not just the current files. Anything that was ever committed gets rotated, not just deleted.
- `.env.example` lists every variable the app reads, with a one-line comment for each and no real values.
- The migrations are the complete, ordered history, and applying them to an empty database produces the schema the app expects.

### Production

- The same Supabase project as development is fine on the free plan, as long as test orders are cleared out before real customers arrive. Every migration is applied from the repository, never by hand in the dashboard.
- The Clerk application's allowed addresses include the production address, and the Supabase Clerk integration points at the same Clerk application.
- Clerk's production instance needs a domain you own, so on the free `vercel.app` address the live site uses Clerk's development instance. The README says so, and the small development banner is accepted.
- 2-step verification is on for every account in the admins table, in Clerk and on the Google account behind it. Whoever holds one of them can read every vault.
- The credential encryption key in production is its own key, generated fresh, with a copy saved in a password manager. Losing it loses every vault.
- Every environment variable set in Vercel for Production and Preview.

### Deploy

- The repository connected to Vercel. A push to the default branch deploys production; every pull request gets a preview link.
- A CI workflow on GitHub runs install, type-check, lint, tests, build, and the row-level security check on every pull request.
- Security headers: a content security policy that allows only what the app actually loads, plus the standard frame, referrer and content-type headers.

### Make it attractive

- The home page opens with one sentence saying what Kunji is, the payment methods it accepts as a row of their names, and the catalogue right under it. No hero image that pushes the products below the fold on a phone.
- Favicon, app icon, page titles, and Open Graph images, so a link shared on WhatsApp or Instagram shows a proper card.
- A real 404 page and a real error page, in the store's own style.
- A README with a one-line description, the live link, screenshots of the storefront, the vault, the verification queue and the buy list, what makes it different (honest listings, true statuses, encrypted vault), a short architecture section, the stack, how to run it locally, and the free-plan limits below.
- A licence file and the repository's description, website link and topics on GitHub.

## Constraints

- **Nothing about how Kunji works changes in this phase.** No new features. A deploy that also changes behaviour makes every production bug ambiguous.
- **Vercel's free Hobby plan is for non-commercial use.** It's fine for testing and showing the project. Before the first real customer pays, the store moves to Vercel Pro or to a host whose free plan allows commercial use, such as Netlify. The README says this plainly. Nothing in the code depends on a Vercel-only feature, so the move is configuration, not a rewrite.
- **Everything runs on free plans**: Vercel Hobby (while testing), Supabase Free, Clerk Free, Resend Free. No paid add-on, no paid domain. When a free limit is hit, the app says so plainly.
- **Supabase's free plan pauses a project after a week with no activity.** The README says so. A live store with customers won't hit it; a demo left alone will.
- Row-level security is checked in production, not assumed from development.
- Environment configuration still fails loudly. A production deploy with a missing variable fails the build, not the first customer's checkout.
- The landing and storefront follow the same interface rules as the rest of the app. No ambient animation, no urgency.

## Acceptance check

1. Clone the repository fresh into an empty folder, follow only the README, and the app builds and its tests pass.
2. A secret scan of the full git history finds nothing live.
3. Open the production link on a phone in a private window. The catalogue loads without signing in, every card shows its honest facts, and nothing on the page names the supplier.
4. Sign in on production as a second account with each enabled method, buy the cheapest product with a real wallet payment to yourself, approve it from the queue on your phone, buy it on numastore from the buy list, deliver it, and find it in the customer's vault.
5. Signed in as a second account, the first account's orders and vault don't come back from the query.
6. Run the row-level security check against production. Every table passes.
7. Open a pull request with a trivial change. CI runs and passes, and a preview link appears.
8. Paste the production link into WhatsApp. A proper preview card appears.
9. Run Lighthouse on the home page in mobile mode. Performance, accessibility, best practices and SEO are all green.
10. Switch the theme, reload, and the choice holds.
11. Visit a URL that doesn't exist and get the store's own 404 page.

## Not in this phase

New features of any kind. A custom domain, paid plans, Clerk's production instance. Automatic payment verification. Automatic buying on numastore. Moving hosts, which happens when real sales start, not as part of shipping the demo.
