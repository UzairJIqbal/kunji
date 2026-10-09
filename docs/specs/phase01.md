# Phase 1 — Sign-in and the shell

## Goal

Someone signs in with Google, lands on a page that knows who they are, and sees it in the theme they prefer.

## Where this starts

A fresh Next.js 16 app with Tailwind v4 and shadcn/ui, and a Supabase project with Google sign-in switched on in its dashboard. Nothing else exists yet.

## Build

- **Sign in with Google**, through Supabase Auth. Signing in for the first time creates the account without asking anything else. Signing out works from anywhere.
- **The signed-in user is readable during server rendering**, not only in the browser.
- Signed-out visitors to a protected page (the account area, the admin area) are sent to sign in before anything renders, and come back to the page they wanted afterwards.
- The storefront pages are public. Browsing never asks anyone to sign in.
- A theme control with three states: follow the system, force light, force dark. Written to the root element so the colour tokens key off it.
- **The shell everything later renders inside.** A header with the store's name, a link to the account area, and the sign-in button. An account area with empty places for orders and the vault. An admin area with an empty place for the queue. Later phases fill these; they don't move them.
- The colour tokens from the project doc: greyscale surfaces, one blue accent, and green, amber and red reserved for status.

## Constraints

- **One session system, set up the way Supabase documents it for the App Router**, with the session refreshed in one middleware. A second hand-rolled cookie or session store is a bug that presents as random sign-outs.
- **The database client carries the signed-in user's session** on every request from server code. Nothing queries anything yet, but a client wired up anonymously looks fine until the first policy exists, and then returns nothing.
- No hand-written login form. Google sign-in is a button.
- The service key is not used anywhere in the app. If it seems to be needed, something is designed wrong.
- Environment configuration fails loudly at startup if it's missing. A blank value that produces a confusing error three screens later is worse than a crash on boot.
- The shell works at phone width first. Check it at 360 pixels wide before checking it on a laptop.
- Nothing here creates a table.

## Acceptance check

1. Sign in with a Google account that has never used the app. You land back in the store, signed in, without being asked anything.
2. Render the signed-in user's name in a server component. It's there on first paint, not after the page hydrates.
3. Visit the account area while signed out. You're sent to sign in, and after signing in you land on the account area, not the home page. In the network tab, the account page's HTML was never sent before sign-in.
4. Switch the theme, reload, and the choice holds. All three states work, and forcing light while the phone is in dark mode actually wins.
5. Open the app at phone width. The header fits on one line and nothing scrolls sideways.

## Not in this phase

Any table. The admin role. Any product, order or price. Styling beyond the shell and the tokens.
