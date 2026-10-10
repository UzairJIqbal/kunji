# Kunji

A reseller store for digital subscriptions in Pakistani rupees. A customer
orders and pays from a mobile wallet, the seller checks the payment, buys the
same item on numastore.pro by hand, and pastes the credentials into the
customer's private, encrypted vault. An order's status is always true, and a
listing always says what it really is.

Why any of these rules exist is in `docs/project-doc.md`. This file is the
rules themselves.

## Stack

Next.js 16 App Router, React 19, TypeScript strict. Tailwind v4 and shadcn/ui.
Clerk for sign-in. Supabase for Postgres, row-level security, Storage and
Realtime, trusting Clerk's session token through Supabase's Clerk integration. Node's built-in crypto for encrypting credentials. Zod at every
boundary. An ntfy push for pings to the seller. pnpm.

Next.js 16 changed a lot. If you're not certain about an API, read the docs
inside the installed package rather than going from memory. Same for
Clerk's and Supabase's App Router setup: follow their current docs, not an old
snippet.

## How we work

Spec driven. Nothing gets built without a spec.

- `docs/project-doc.md` — what this app is and every decision behind it. Read
  the part you need. Don't ask me to paste it.
- `docs/specs/phaseNN.md` — one per phase. Behaviour and an acceptance check,
  never filenames.
- This file — always true, read on every prompt.

**Starting a phase.** Read this file and that phase's spec. Build what the spec
asks and stop.

**Dropped into a fresh context and don't know where we are?** Look at which
files exist in `docs/specs/`, then the git log. The last commit is the last
phase that passed. Tell me what you've worked out before building on it.

**Finishing a phase.** After I've run the acceptance check, commit the phase
as one commit and push it straight to main. Two exceptions: Phase 6 (approving
payments) and Phase 8 (the vault) go on their own branch as a pull request,
and I merge them after CodeRabbit's review is clean. Money and credentials get
a second pair of eyes.

**The acceptance check is mine to run, not yours.** It's a list of things I do
by hand in a browser or on my phone. Don't automate it, don't install a test
runner or browser driver for it. Build so those things are true, then tell me
it's ready.

**What you check before saying a phase is done:** types, lint, tests, build,
and the row-level security check once it exists. Anything verifiable from a
terminal in a few seconds is yours — running a script and reading its output
counts. Anything needing a browser is mine.

**When a phase comes out wrong, I reset rather than patch.** Prompting on top of
wrong code three times leaves code nobody understands, including you. So if a
spec is ambiguous, say so _before_ you build.

## How to talk to me

Short. If a sentence isn't telling me something I need, cut it.

**Ask with an answer attached.** One specific question, and say which way you'd
go and why. "A or B, I'd take B because the database enforces it" is
answerable in two seconds. An open question isn't. Never pick a direction
silently, never build both.

**When you need something only I can give you** — a key, a token, a value in
`.env.local`, a setting in the Clerk or Supabase dashboard — say exactly what
and exactly where, then stop.

**No walls of text.** Don't summarise every file you touched or restate the plan
back to me. When a phase is done, say what it does and what the check should
show, in a few lines.

**Plain English.** If you're reaching for a bulleted breakdown of something
that's one sentence, it's one sentence.

**Say when something didn't work.** A failure worked around quietly costs me an
hour later.

## How the code is laid out

You pick the file structure. These are about behaviour.

- **Database access happens in server code**, not inside components.
- **The Supabase MCP is for looking, not changing.** Use it to inspect the
  schema, run checks and read the security advisor. Every schema or seed change
  is a file in the repository first; the MCP may apply that file, never ad-hoc
  SQL. If the database and the migration files disagree, the files win.
- **Who may read or write a row is decided by a policy**, never by application
  code. If a query needs a `where` clause to return the right rows, the policy
  is wrong.
- **Admin power is a row in the admins table**, read by the policies. Never an
  email list in the code, never a check in a component.
- **Order status changes in one place**, the database, which knows the allowed
  moves and records each one. The app asks for a move; it never writes a status
  column directly.
- **Anything that changes several rows together is a database function.**
  Approving a payment, recording a purchase, delivering, replacing.
- **One module encrypts and decrypts credentials.** Nothing else touches the
  key or the plain text.
- **Pure functions for money and dates** — sell price, margin percentage,
  expiry, warranty end, pro-rata refund — with tests. Nothing to mock in order to check them.

## Conventions

Strict TypeScript, no `any`. If a type is genuinely awkward, tell me rather than
casting.

Comment the decisions, not the syntax.

Money is whole rupees in integers, shown as `Rs 1,200` everywhere. Times are
shown in Pakistan time.

Every value from a browser is validated with Zod on the server. A price, amount
or status from the browser is never trusted.

One obvious way to do something beats a configurable one.

The storefront is built for a phone first: check every screen at 360 pixels wide
before a laptop. The admin area is a dense working tool: small type, tight
rows, monospace for order numbers and transaction IDs. Colour means status or
isn't there. Nothing moves unless it was tapped.

**All UI work uses the frontend design skill.** Load it before building any
screen. But the paragraph above overrules it — it will reach for motion, big hero
images and decoration, and this is a store someone opens on a slow phone
connection to buy one thing.

## Things not to do

Breaking one of these is worse than not finishing.

- **Never store, log or send a credential in plain text.** Not in the database,
  a log, an error message, a URL, a toast, an analytics event or a commit. Not
  even in an error path.
- **Never mark an order paid without the seller approving it.** Uploading a
  receipt moves it to verifying, nothing more. (From Phase 12, an exact match
  against the wallet's own SMS also counts. Nothing looser ever does.)
- **Never automate numastore.** The app doesn't scrape it, read its prices,
  log in to it or buy from it. The seller does that by hand; the app only
  stores the link and what the seller records.
- **Never show a customer anything about the supplier.** Supplier price,
  margin, numastore link and numastore order numbers are admin-only, enforced
  by policy.
- **Never invent something to fill a gap.** No fake reviews, fake stock counts,
  fake urgency or listing claims the seller didn't write. Absent beats made up.
- **Never use the service key in the app.** If something seems to need it, the
  policy is wrong; tell me.
- **Don't copy another store.** No numastore names, logos, images or text on
  Kunji. Every product is written by the seller.
- **Don't install a package without asking.** Name it, say what for, wait.
- **Don't build ahead of the current phase.** No scaffolding for what's coming.
- **Don't leave the build broken.** Tell me about a failure instead of working
  around it.
- **Don't weaken a check to make it pass.** A check that can't run has to fail
  loudly.
- **Don't read from the database on a loop.** Name your columns, limit list
  reads, subscribe instead of polling.
