# Kunji

The product decisions behind this build, written before it starts, with the reasoning attached. The reasoning matters more than the decision — you'll hit forks this doesn't cover, and you'll need to know which way the thinking was leaning.

Read the part you need before you build something. Don't read it all at once, and don't paste it into a prompt.

## The name

*Kunji* is Urdu for key. Everything this store sells is, in the end, a key: a
login, a licence, an invite. And the one place every customer comes back to is
the vault where their keys are kept. In Pakistan a *kunji* is also the guide
book students use to get through exams, which fits the people most likely to
buy here.

Check the domain and the Instagram handle are free before printing it anywhere.

## What it is

A reseller store for digital subscriptions in Pakistani rupees. Kunji lists
items that the supplier, numastore.pro, sells: AI tools, design tools, VPNs and
learning apps. Each one is priced at the supplier's price plus a flat margin of
around Rs 150–200.

The pipeline is the whole business:

1. A customer finds Kunji on Instagram, WhatsApp or the site, picks a product,
   and places an order.
2. They pay with Easypaisa, JazzCash, NayaPay, SadaPay or a bank transfer, then
   type in the transaction ID and upload the receipt.
3. The seller checks the money arrived and approves it.
4. The seller buys the same item on numastore.pro with their own account.
5. numastore drops the credentials into the seller's numastore vault.
6. The seller copies them into the customer's Kunji vault. The order is
   delivered, and the customer's order page updates without a refresh.
7. If the account stops working inside the warranty, the customer opens a
   ticket on Kunji. The seller claims a replacement from numastore and passes
   it on, or refunds.

Kunji never holds stock. Every order is bought from the supplier after the
customer has paid, so the only money the seller ever risks is a single order's
cost.

## The problem

Three things stop a Pakistani student or freelancer paying for ChatGPT, Canva
or a VPN. They don't have an international card. The official price in dollars
is out of their budget. And buying from a seller on Instagram or WhatsApp means
sending money to a stranger and hoping something comes back.

The seller's problem is the pipeline above done by hand in WhatsApp chats and a
notebook. Payments to match against screenshots. A list of paid orders still
waiting to be bought on numastore. Logins pasted into chats and lost three
weeks later. Nobody remembering which numastore order belongs to which
customer when a warranty claim comes in.

The first set is why the store exists. The second set is what the software is
actually for.

## Who it's for

Two people.

**The customer** is a student or freelancer in Pakistan, on a phone, paying from
a mobile wallet. They've been burned before or know someone who has. They want
to know exactly what they're buying, see that their money arrived, and find
their login again later.

**The seller** is one person running the pipeline from their phone between
other things. Their day is checking wallet notifications, buying on numastore,
and copying logins across. Anything that makes those three steps faster and
harder to get wrong is the point.

This description is the test every feature gets measured against. When
something tempting comes up — a points system, a referral programme, a
countdown timer — the question is whether either of these two people wants it.
Usually they don't. The customer wants to trust the store. The seller wants
fewer steps per order.

## The business behind it, and why it shapes the software

Read the reseller report before Phase 1. What it says, in short, and what the
build does about each point:

- **Delivery becomes manual.** numastore's selling point is instant delivery.
  Kunji's delivery is the seller noticing the payment, buying on numastore and
  copying the login across. The software can't remove those steps; it can make
  each one a single tap, so "within 30 minutes" is a promise the seller can
  keep. The time from payment to delivery is measured and shown to the seller.
- **A flat margin is a very different percentage on each item.** Rs 175 is
  over 40% on a Rs 400 item and under 1% on a Rs 25,000 one, and a Rs 50 item
  can't carry it at all. The seller sets the margin per plan in rupees, as the
  plan is, and the admin screen shows it as a percentage beside every price, so
  the bad ones are visible. It doesn't change the model; it keeps the numbers
  honest.
- **Customers can see numastore's price.** The edge is trust, speed of reply,
  and support in their own language, not price. That's why the honest product
  page, the live order status and the WhatsApp link are core features rather
  than polish.
- **numastore's prices and stock change.** Kunji can't read them automatically
  (see "Out of scope"). So every product shows the seller when its supplier
  price was last checked, and the seller can mark a product sold out in one tap.
  When numastore runs out after a customer has paid, the order is refunded, not
  left hanging.
- **Your own brand.** No numastore name, logo, images or text on Kunji. Every
  product is written by the seller.

**The warranty problem, which has to be solved before Phase 1.** numastore's
refund policy says its warranty is void for "sharing or reselling access
credentials intended for single-user purchase." As the pipeline stands, a
claim the seller makes on a resold item may be refused, and then the seller
pays for every replacement themselves. So the first job isn't code: ask
numastore, in writing, for permission to resell and a reseller price. If they
say no, the warranty Kunji offers has to be one the seller can afford to cover
alone, and the docs below assume the seller may have to buy a fresh item
instead of claiming one.

The reports also say cheap subscriptions often come from shared, student or
promotional accounts that break the provider's terms. Kunji's product pages say
plainly what each item is, so a customer is never surprised by it.

## The rule everything rests on

**An order's status is always true, and a listing always says what it really
is.**

*Paid* means the seller checked the money arrived. Uploading a screenshot never
makes an order paid. *Bought* means the seller placed a real numastore order for
it, and that numastore order number is recorded against it. *Delivered* means
the credentials from that purchase are in this customer's vault, and in no other
customer's. *Replaced* and *Refunded* mean that actually happened, with a record
of when and by whom.

The reason, bluntly: this store's whole value is trust, and its customers have
been lied to before. A status that says "delivered" when nothing arrived, a
badge that says "Low stock" to create pressure, a product page that hides that
it's a shared slot — any one of these turns the store into the thing its
customers were afraid of. The order page and the product page are the promise.
They have to be true.

Pressure to break this will come from two directions. Sales pull toward urgency
and vagueness — fake countdowns, "only 2 left", "100% legit lifetime". Speed
pulls toward skipping the payment check because it's slow. Both are refused.

## Scope

- Sign-in through Clerk (Google, and email codes if switched on), for customers
  and the seller alike.
- One admin role, given to specific accounts in the database. Everyone else is
  a customer.
- A catalogue: products with plans (duration, supplier price, margin, warranty),
  a category, the honest facts about each, the link to the same item on
  numastore (admin-only), and badges that are facts: sold out, new.
- Checkout: pick a plan, give the activation email if the product needs one
  (typed twice, then shown large before paying), pick a payment method, see
  the exact amount and the account to send it to.
- Payment proof: transaction ID, the wallet number it was sent from, and the
  receipt image. A transaction ID can only ever be used once.
- An "away" switch for the seller. While it's on, every page says when orders
  will be handled, before anyone pays.
- A verification queue for the seller that updates live.
- **The buy step**: a list of paid orders waiting to be bought, each with a link
  straight to the item on numastore, the plan, and the customer's activation
  email ready to copy. The seller records the numastore order number and what
  they actually paid.
- **Supplier out of stock**: one tap marks the product sold out and moves the
  paid order to a refund.
- A vault: every credential a customer bought, encrypted, revealed on a tap,
  with setup instructions and an expiry date.
- Warranty tickets: claim from numastore and forward, buy a fresh one, or
  refund.
- Reviews, only from customers whose order was delivered.
- Reports: sales, real margin per order, refunds and replacements, and how long
  orders wait at each step.
- Live order status for the customer, without refreshing.

## Out of scope, and why

Each of these is something a model will propose, because each of them sounds
like an improvement. The reason matters more than the refusal.

- **Buying from numastore automatically.** numastore has no reseller API. Doing
  it with a bot logging into the seller's account and clicking through checkout
  is fragile, breaks when their site changes, and is the fastest way to get the
  seller's numastore account banned, which ends the business. The seller buys
  by hand; Kunji makes it one tap away.
- **Reading numastore's prices or stock automatically.** Scraping their site is
  the same risk, and it's their catalogue, not ours. The seller checks, and
  Kunji shows how long ago that was.
- **Copying numastore's catalogue, text or images.** Every product is entered
  by the seller in their own words.
- **Holding our own stock in v1.** Buying a few accounts in advance and
  handing them out automatically is planned as Phase 13, for best sellers only,
  once the reports show which ones those are. It needs money up front and
  changes the risk, so it waits until the basic pipeline has proven itself.
- **Automatic payment verification in v1.** Easypaisa and JazzCash merchant
  APIs need a registered business account, so they're out entirely. A person
  checks every payment, and the software makes that check fast and hard to
  fool. Phase 12 makes sure the seller hears about each payment straight away.
- **Binance Pay and crypto.** Needs a verified merchant account, and the legal
  position of crypto payments for a Pakistani business is unsettled.
- **Fake urgency of any kind.** Countdown timers, "12 people are viewing this",
  "only 2 left". Kunji doesn't even know numastore's stock count, so any such
  number would be invented.
- **An AI support chatbot.** Support here is about money and trust. A bot that
  promises a replacement the warranty doesn't cover costs real rupees, and the
  customers are already on WhatsApp.
- **Points, referrals, coupons, wallets with stored balance.** Each one is a
  second ledger to keep true.
- **Passwords.** Customers sign in with Google or a one-time email code, both
  handled by Clerk. Nobody has a Kunji password to forget or leak.
- **Clerk organizations.** One store, one seller. Who is an admin is a row in
  the database, not a Clerk organization or role.
- **Guest checkout.** A credential has to land somewhere the customer can come
  back to.
- **Multiple suppliers.** numastore is the supplier. The data keeps a supplier
  name and order number on every purchase, so adding a second one later is a
  new row, not a new schema, but no screen for choosing between suppliers is
  built.
- **Urdu interface.** Simple English first.
- **Queues, workers, a separate backend.** One deployable application.

## The stack, and why

Chosen from what you've already shipped, so the new things to learn are the
business rules and not the tools.

- **Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4,
  shadcn/ui.** The same as Flowlens. Server components keep credentials and
  admin data on the server by default.
- **Supabase** for almost everything else: Postgres with row-level security
  (the authorization layer, exactly as in Flowlens), Storage for receipts and
  product images, Realtime for live order status and the admin queues, and
  Postgres functions for status changes.
- **Clerk for sign-in**, the same as Flowlens. It handles Google sign-in and
  email codes, including sending the emails, so there's no mail service to set
  up. Supabase trusts Clerk's session token through Supabase's Clerk
  integration, and the policies read the signed-in user's Clerk ID off that
  token, exactly as Flowlens read the organization claim. One catch: Clerk's
  production instance needs a domain you own. On a free `vercel.app` address
  the live site runs on Clerk's development instance, which shows a small
  banner and has a cap on users. That's accepted for testing and the first
  customers; buying a domain later lifts both, and only configuration
  changes.
- **Node's built-in crypto** to encrypt credentials before they reach the
  database. No package needed.
- **Zod** at every boundary where data comes from a browser.
- **Web Push and Resend** (free plan) to tell the seller about new payments,
  from Phase 12. A notification never carries anything private: only an order
  number, amount, method and a link to the admin screen, which needs the
  seller's sign-in anyway.
- **pnpm, GitHub Actions CI, CodeRabbit.** A small one-person store doesn't
  need a review on every phase, so phases go straight to main. CodeRabbit
  reviews only the two phases where a bug costs money or leaks a login:
  Phase 6 (approving payments) and Phase 8 (the vault).
- **Vercel Hobby to build and test on.** Read the hosting note below before the
  first real sale.

**Hosting note.** Vercel's free Hobby plan is for non-commercial use. Building,
testing and showing this as a portfolio project is fine there. Once the store
takes real customers' money, it has to move: either Vercel Pro (paid), or a
host whose free plan allows commercial use, such as Netlify, which runs
Next.js too. So the code stays portable — nothing in it depends on a
Vercel-only feature like Vercel Cron.

## How it works

No folder names here — the structure is yours to choose. These are constraints
on behaviour.

**Money is whole rupees, stored as integers.** No floats, no paisa. Every price
shown is formatted one way, `Rs 1,200`.

**A plan's price is the supplier price plus the margin.** The seller enters
both; the sell price is worked out, never typed separately, so the two can't
drift apart. The supplier price and margin are admin-only.

**The price comes from the database at the moment of ordering.** The browser
says which plan; the server reads the price. An amount sent from the browser is
never trusted, and the order keeps the price it was placed at even if the plan's
price changes later.

**What the seller actually paid numastore is recorded on the order** when it's
bought, separately from the supplier price the plan listed. numastore's price
can move between the customer paying and the seller buying, and the reports
need the real number.

**Access is a policy, not a check the application remembers.** Row-level
security on every table. A customer's query for orders returns their orders
because of the policy, not because of a `where` clause. The seller's admin
power comes from a row in an admins table, read by the policies. The database's
all-powerful service key is never used by the running app; if something seems
to need it, the policy is wrong.

**Row-level security is on by default, not per table.** An agent is writing
these migrations, and the two failure modes are not symmetrical. A table with
security on and no policy returns nothing, which is visible. A table where
someone forgot returns every customer's orders to everyone, silently. A check
that fails when any table lacks it runs in CI.

**Status moves through one place.** The order's possible states and the allowed
moves between them are defined once, in the database. An illegal move — say,
from *awaiting payment* straight to *delivered* — fails in the database, not
just in the interface. Every move is recorded with who made it and when, and
the customer's order page is drawn from that record.

The states:

- *Awaiting payment* → *Verifying* (proof submitted) → *Paid* (seller approved
  the money) → *Bought* (seller bought it on numastore, order number recorded)
  → *Delivered* (credentials in the vault).
- *Verifying* → *Rejected* (seller rejected, with a reason). A rejected payment
  can still be approved later if the money turns up.
- *Rejected* → *Refunded* when money did arrive but the order can't go ahead,
  for example the wrong amount was sent. The seller sends it back and records
  it.
- *Paid* → *Refunded* when numastore is out of stock or can't supply it.
- *Delivered* → *Replaced* or *Refunded* through a warranty ticket.

The customer sees *Paid* and *Bought* as one step, "Preparing your order",
because the difference is the seller's business, not theirs. The seller sees
both, because a paid order nobody has bought yet is the one thing they must not
forget.

**Expiry tidies the list; it never refuses money.** An unpaid order has an
expiry time, two hours out. Past it, the order is shown as expired and drops
out of the customer's limit on open orders. But Kunji holds no stock, so
there's nothing for an expired order to give back, and a customer who paid at
the last minute must never be locked out. An expired order still accepts proof,
which moves it to *verifying* like any other. Expiry is worked out when the
order is read. No scheduled job, which keeps the app free of Vercel Cron and
portable to another host.

**Credentials are encrypted before they reach the database**, with a key that
lives only in the server's environment. A leaked database dump shows
ciphertext. They're decrypted only in server code, only for the customer who
owns them or the seller, and only when someone taps reveal. Every reveal is
recorded. A credential never appears in a log, an error message, an analytics
event or a URL.

**One purchase, one order.** Every numastore order number is recorded once.
The same numastore order number can't be attached to two Kunji orders, which
catches the seller pasting the wrong one on a busy evening.

**A transaction ID can be used once.** Unique per payment method, enforced by
the database. This is the main defence against the same receipt screenshot
being sent for two orders.

**Receipts are private.** Stored in a private bucket, shown to the seller
through short-lived links, and to nobody else except the customer who uploaded
them.

**Live updates come from subscriptions, never polling.** The customer's order
page and the seller's queues both subscribe to changes. Nothing reads the
database on a loop.

**Notifications to the seller never block the order.** If one fails, the order
still goes through and the failure is logged. The queues on the admin screen
are the source of truth; a notification is a convenience.

## The interface

Two halves with different jobs.

**The storefront is built for a phone first.** Most customers arrive from an
Instagram or WhatsApp link on a mid-range Android phone on mobile data. Pages
are light, images are small, and every flow works one-handed at phone width
before it's checked on a laptop. Large tap targets, prices big and clear.

**The admin screen is a dense working tool, used mostly on a phone.** The seller
has their wallet app and numastore open on the same phone. Small type, tight
rows, monospace for transaction IDs and order numbers so `0` and `O` can't be
confused, and copy buttons on everything that gets pasted into numastore or
back from it.

**Colour carries meaning or it isn't there.** Status earns colour: green for
paid and delivered, amber for waiting on someone, red for rejected, cancelled
and refunded. One blue accent for anything you can tap. Everything else —
surfaces, borders, body text — is greyscale.

**Dark and light, and the user's choice wins.** Three states: follow the system,
force light, force dark. The choice survives a reload. Both palettes are real
palettes, not one inverted.

**Nothing moves on its own.** No carousels, no pulsing "buy now", no animated
banners. Motion happens because something was tapped.

**Honest facts sit next to the price, not below the fold.** Account type,
duration, warranty and delivery time are part of the product card, in the same
place on every product.

**When the seller is away, the store says so before anyone pays.** One switch
in the admin area. While it's on, a banner on every page and on checkout says
when orders will be handled ("Orders placed now are delivered after 10am"). A
customer who pays at 2am knowing that won't think they've been scammed at 2:05.

**Every customer screen has a way to a human.** A WhatsApp link with the order
number already filled in, on every order and every ticket.

**The shell gets built once.** Where the header, the account area and the
admin area sit is settled in Phase 1. Later phases fill them in; they don't
rearrange them.

## After v1: upgrades that wait for real numbers

The plan is to ship the basic pipeline, run it with real customers, and add
automation only where the reports show it's needed. Two upgrades are planned,
and each one is built only once there's evidence for it, such as orders
regularly waiting more than 30 minutes.

**Phase 12: new order notifications.** When a customer submits payment proof,
the seller gets a browser notification (Web Push) on every device they've
switched on, and an email through Resend's free plan.
Each says only the order number, amount and method, with a link to the queue.
Nothing is approved automatically: the seller still approves every payment, so
*paid* still means a person checked the money arrived.

**Phase 13: a small stock of best sellers.** For products where numastore
hands over a login (not ones activated on the customer's own email), the
seller buys a few in advance. A paid order for a stocked plan goes straight
to the vault the moment the seller approves the payment, with no buying step,
and still nothing ever touches numastore automatically.

What stays manual even then: buying on numastore. There's no safe way to
automate it without an API from them, and a bot on the seller's account risks
the whole business. If numastore ever offers a reseller API, that changes.

## Where this is likely to go wrong

**The warranty.** numastore voids its warranty for resold credentials. If that
isn't sorted with them first, every broken account is a cost the seller covers
alone, and with a Rs 150–200 margin, one replacement can wipe out the profit of
several orders. The reports phase shows this number so it can't hide.

**A paid order that nobody bought.** The seller approves the payment, gets
distracted, and the order sits. This is the most likely way to lose a customer.
The buy list shows how long each paid order has been waiting, oldest first, and
the oldest waits are marked in amber.

**numastore out of stock after the customer paid.** It will happen, often with
the popular items. The refund path has to be one tap and the customer has to
hear about it immediately, not after they ask.

**numastore's price going up.** The order keeps the customer's price; the
seller's real cost is recorded. A margin that quietly went negative shows up
in the reports, and the plan's "last checked" date nags the seller to update
it.

**Credentials leaking through a side door.** The database column is encrypted,
and then the plain text turns up in a server log, an error report, or a
browser cache. Every path a decrypted credential travels is a place to check.

## What has to be true before this ships

Not "it looks right". Specifics:

- Signed in as one customer, another customer's orders, payments, receipts and
  vault entries do not come back from the query at all.
- Every table in the schema has row-level security enabled. Not most of them.
- Reading the credentials column directly in the database shows ciphertext only.
- An order cannot reach *Delivered* without passing through *Paid* and
  *Bought*, and *Bought* cannot be saved without a numastore order number.
- The same transaction ID cannot be submitted for two orders, and the same
  numastore order number cannot be attached to two orders.
- Changing a price in the browser's request does not change what the order
  costs.
- No customer can ever see the supplier price, the margin, the numastore link
  or the numastore order number.
- A customer who submits proof after their order expired still lands in the
  verification queue.
- Every admin account has 2-step verification on, in Clerk and on the Google
  account behind it. Whoever holds one can read every vault.
- Every product page states account type, duration, warranty and delivery
  time, and every badge on it is true at that moment.
