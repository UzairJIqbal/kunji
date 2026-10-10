# Phase 9 — Warranty tickets

## Goal

When an account stops working inside its warranty, the customer reports it from the order, and the seller gets them a working replacement or their money back, with a record of which it was and what it cost.

## Where this starts

Orders are delivered into the vault, each tied to the numastore order it was bought with. When something breaks, the only route is WhatsApp, and Kunji keeps no record of it.

## Build

- **"Report a problem"** on a delivered order's page and its vault entry, shown only while the warranty hasn't ended. After that, the button is replaced by the date it ended and the WhatsApp link.
- **A ticket**: what's wrong, picked from a short list (login doesn't work, subscription ended early, other) plus a free-text note, and an optional screenshot. One open ticket per order.
- **A ticket thread.** The customer and the seller can both add messages. New messages appear live on both sides.
- **The seller's ticket list** in the admin area, open tickets first, with the product, days of warranty left, and the numastore order number with a copy button, ready to paste into a numastore support ticket.
- **"Claimed with numastore".** The seller records the numastore ticket reference. The customer sees "We're getting you a replacement".
- **Three ways to close a ticket.**
  - **Replace from the claim**: the seller pastes the replacement numastore gave. It goes into the same vault entry; the old credential is kept, marked replaced.
  - **Replace by buying a new one**: for when numastore refuses the claim. The seller buys a fresh one on numastore, records the new numastore order number and what it cost, and pastes the credential. The cost is recorded as a replacement cost against this order.
  - **Refund**: the seller records the amount, method and reference. The form suggests the unused share (price × days left ÷ days bought), and the seller can change it up to the full price.
  Each one moves the order to *replaced* or *refunded*.
- A replaced order can have another ticket opened while its warranty lasts. Warranty runs from the original delivery, not from the replacement.
- A ping when a ticket is opened.

## Constraints

- **The warranty end date is checked in the database.** A ticket on an order past its warranty is refused there, not just hidden in the interface.
- **The replaced credential is kept**, marked replaced, not deleted. The reports phase counts it.
- **What a replacement cost the seller is recorded**, zero when numastore covered it, the real amount when the seller bought a new one. The reports need to know which.
- The replacement credential goes through the same encryption, reveal recording and never-logged rules as every other credential.
- A refund never exceeds what the order cost.
- Screenshots on tickets follow the receipt rules: private bucket, owner and admins only, short-lived links.
- The numastore order number and ticket reference stay admin-only. The customer's side of a ticket never shows them.
- Ticket messages are subscriptions, not polling.

## Acceptance check

1. On a delivered order inside its warranty, report a problem. The seller sees it in the ticket list with the numastore order number, and gets a ping.
2. Exchange two messages. Each appears on the other side without a refresh.
3. Mark it claimed, then replace from the claim. The customer's vault entry shows the new login, the order shows *replaced*, the old login is still visible to the seller marked replaced, and the replacement cost is zero.
4. On another order, replace by buying a new one at Rs 900. The new numastore order number is recorded and the replacement cost is Rs 900.
5. On a third order with 15 of 30 days left at Rs 600, choose refund. The form suggests Rs 300. Try Rs 700. It's refused.
6. Set an order's delivery date back past its warranty. The button is gone, and creating a ticket for it directly against the database is refused.

## Not in this phase

Store credit. Automatic refunds to wallets. Raising tickets on numastore from inside Kunji.
