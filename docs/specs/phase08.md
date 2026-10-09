# Phase 8 — The vault

## Goal

The credentials the seller got from numastore land in the customer's private vault, encrypted at rest, revealed on a tap, and findable months later.

## Where this starts

Paid orders get bought on numastore and wait at *bought*. The credentials are sitting in the seller's numastore vault. There's nowhere in Kunji for them to go, and no credential has ever been stored.

## Build

- **Delivering.** On a bought order, the seller pastes what numastore delivered: a login and password, a licence key, or a note saying an invite was sent to the customer's activation email. Saving creates a vault entry and moves the order to *delivered*. It's reachable straight from the buy list, so buying and delivering are one flow on the seller's phone.
- **The vault**, in the account area. One entry per delivered order: product, plan, delivered date, expiry date (delivery date plus the plan's duration), warranty end date, and the product's setup instructions.
- **Credentials are hidden until tapped.** Tapping reveal shows them with a copy button. Each reveal is recorded with who and when.
- **The setup instructions warn about what voids the warranty**, as the seller writes it for each product (for shared accounts: don't change the password, email, phone or 2FA). This is shown above the credential, every time.
- Entries within a week of expiry are marked "expiring soon". Expired ones move to a separate list rather than disappearing.
- The order page links to its vault entry once delivered, and the delivery shows up live, like every other status change.
- The seller can see an order's credential from its admin page the same way, with the same recorded reveal.

## Constraints

- **Credentials are encrypted before they reach the database**, with a key that exists only in the server's environment. Node's built-in crypto, authenticated encryption, no package. Reading the column in the database dashboard shows ciphertext.
- **Decrypted only in server code, only on reveal, only for the owner or an admin.** The vault list itself never carries the plain credential to the browser; it's fetched on tap.
- **A credential never appears in a log, an error message, a URL, an analytics event or a trace.** Including error paths. If a delivery fails, the message says it failed, not what was being saved.
- **Losing the key loses the vault.** The README says to keep a copy of it in a password manager, and the app fails loudly at startup without it.
- *Delivered* can only be reached from *bought*. The database refuses anything else.
- Warranty runs from the moment it's delivered in Kunji, matching how numastore counts its own warranty from delivery to its vault.

## Acceptance check

1. Pay, get approved and get bought as a customer. As the seller, paste a login from the buy list. The customer's order page changes to *delivered* without a refresh and links to the vault.
2. In the vault, the entry shows dates, setup instructions and the warranty warning, with the credential hidden. Tap reveal, the credential shows, and the seller can see that reveal recorded.
3. Open the vault entries table in the Supabase dashboard. The credential column is unreadable.
4. Search the server logs for the password you delivered. It isn't there.
5. Signed in as a different customer, ask the database for the first customer's vault entries and their reveal records. Nothing comes back.
6. Try to deliver to an order that's only *paid*. It's refused.
7. Set a vault entry's delivery date back so it expires in three days. It shows "expiring soon".

## Not in this phase

Warranty claims. Renewals or reminders sent outside the app.
