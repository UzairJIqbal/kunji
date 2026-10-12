# Phase 6 — The verification queue

## Goal

The seller sees every payment waiting to be checked the moment it arrives, checks it in seconds, and the customer sees the answer without refreshing.

## Where this starts

Customers can place orders and submit a transaction ID and receipt, which leaves the order in *verifying*. Nobody can move it on yet.

## Build

- **The queue, on the admin area's front page.** Every order in *verifying*, oldest first. Each row: order number, product and plan, amount, payment method, the account it was paid into, transaction ID, time submitted, and the receipt as a thumbnail that opens full size.
- **Approve** moves the order to *paid*. **Reject** asks for a reason, picked from a short list (amount wrong, transaction not found, receipt unreadable) or typed, and moves it to *rejected*. A rejected order can still be approved later from its admin page if the money turns up.
- **Refunding a rejected order.** When money did arrive but the order can't go ahead (the wrong amount was sent), the seller sends it back to the wallet number the customer gave, and records the amount, method and reference. The order moves to *refunded*.
- **The away switch.** One toggle in the admin area, with a "back at" time. While it's on, a banner on every storefront page and on checkout says "Orders placed now are delivered after 10am" (using the time set). Switching it off removes the banner everywhere, live.
- **The queue updates live.** A new proof appears without a refresh; a row approved on the seller's phone disappears from the laptop.
- **The customer's order page updates live.** Approved, rejected, and the rejection reason appear without a refresh.
- An admin page for any single order: its full timeline, the customer's WhatsApp number as a tap-to-chat link, and the actions allowed from its current state.

## Constraints

- **Live updates are subscriptions, never polling.** Both the queue and the order page subscribe to changes on the rows the policies already let them see.
- **Approving is one tap, but the facts are side by side.** Transaction ID, amount and method sit next to the receipt so the seller can compare them against their wallet app without opening anything else.
- Every approve and reject is an order event recording which admin did it and when.
- The receipt is shown through a short-lived link, generated when the queue is opened.
- The queue works at phone width, because the seller's wallet app is on their phone. The sender's wallet number shows on each row, so it can be matched against the wallet notification.
- A refund never exceeds the order's price. Every refund records who sent it and when.
- The away switch is a setting stored in the database, readable by anyone, writable only by an admin. Nothing about it is hard-coded.

## Acceptance check

1. With the queue open on a laptop, submit proof from a phone as a customer. The row appears on the laptop without a refresh.
2. Approve it on the laptop. The customer's order page on the phone changes to *paid* without a refresh.
3. Reject another with "amount wrong". The customer sees *rejected* and the reason, live.
4. Approve that rejected order from its admin page. It moves to *paid*, and its timeline shows both decisions and who made them.
5. Copy a receipt link from the queue, wait past its expiry, and open it. It no longer loads.
6. Reject an order for "amount wrong", then record a refund to the customer's wallet number. The customer sees *refunded* with the amount, live.
7. Turn the away switch on with "10am". A customer's open storefront shows the banner without a refresh, and checkout shows it too. Turn it off and it's gone.

## Not in this phase

Buying from numastore and delivering anything. A paid order sits at *paid* until the next phase. Automatic verification of any payment method.
