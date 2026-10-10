# Phase 1 — Sign-in and the shell

## Goal

Someone signs in through Clerk, lands on a page that knows who they are, and sees it in the theme they prefer.

## Where this starts

A fresh Next.js 16 app with Tailwind v4 and shadcn/ui, a Clerk application with Google sign-in (and email codes, if you've switched them on) set up in its dashboard and its keys in `.env.local`, and a Supabase project. Nothing else exists yet.

## Build

- **Sign-in through Clerk**, using Clerk's own components. Signing in for the first time creates the account without asking anything else. Signing out works from anywhere.
- Whichever sign-in methods are switched on in Clerk all lead to the same place. Adding or removing one is configuration, not a code change.
- **The signed-in user is readable during server rendering**, not only in the browser.
- Signed-out visitors to a protected page (the account area, the admin area) are sent to sign in before anything renders, and come back to the page they wanted afterwards.
- The storefront pages are public. Browsing never asks anyone to sign in.
- **Supabase trusts Clerk's token**, through Supabase's Clerk integration, so a policy written in Phase 2 can read the signed-in user's Clerk ID.
- A theme control with three states: follow the system, force light, force dark. Written to the root element so the colour tokens key off it.
- **The shell everything later renders inside.** A header with the store's name, a link to the account area, and the sign-in button. An account area with empty places for orders and the vault. An admin area with an empty place for the queue. Later phases fill these; they don't move them.
- The colour tokens from the project doc: greyscale surfaces, one blue accent, and green, amber and red reserved for status.

## Constraints

- **All UI is built with the frontend design skill**, held to the interface rules in the project doc and AGENTS.md: phone first, no ambient motion, colour only for status.
- **Use Clerk's components rather than rebuilding them.** If a hand-written login form appears in this phase, something has gone wrong.
- **One session system, not two.** Sessions belong to Clerk. Whatever Supabase's own setup snippet installs for refreshing Supabase sessions stays out. Two things owning the same cookie and the same middleware slot is a bug that presents as random sign-outs.
- **The database client carries the signed-in user's Clerk token** on every request from server code and from the browser. Nothing queries anything yet, but a client wired up anonymously looks fine until the first policy exists, and then returns nothing.
- **Nothing downstream asks Clerk a question at runtime** to decide what someone can see. The token carries the user ID; the database's policies read it.
- No Clerk organizations. One store, one seller; who is an admin is decided in the database in Phase 2.
- The service key is not used anywhere in the app. If it seems to be needed, something is designed wrong.
- Environment configuration fails loudly at startup if it's missing. A blank value that produces a confusing error three screens later is worse than a crash on boot.
- The shell works at phone width first. Check it at 360 pixels wide before checking it on a laptop.
- Nothing here creates a table.

## Acceptance check

1. Sign in on a brand new account with each method that's switched on. They all land back in the store, signed in, without being asked anything else.
2. Render the signed-in user's name in a server component. It's there on first paint, not after the page hydrates.
3. Visit the account area while signed out. You're sent to sign in, and after signing in you land on the account area, not the home page. In the network tab, the account page's HTML was never sent before sign-in.
4. Run a query from the browser's Supabase client while signed in, and check in the network tab that the request carries a Clerk token, not an anonymous key alone.
5. Switch the theme, reload, and the choice holds. All three states work, and forcing light while the phone is in dark mode actually wins.
6. Open the app at phone width. The header fits on one line and nothing scrolls sideways.

## Not in this phase

Any table. The admin role. Any product, order or price. Styling the sign-in screens beyond making them match the rest of the app.
