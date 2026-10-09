# Phase 7 — The buy step

## Goal

Every paid order gets bought on numastore quickly and on record, and when numastore can't supply it, the customer gets their money back instead of waiting.

## Where this starts

The seller can approve payments, which leaves orders at *paid*. Nothing tells the seller what to buy, and nothing records that it was bought.

## Build

- **The buy list**, on the admin area's front page beside the verification queue. Every order at *paid*, oldest first, with how long it has been waiting. It updates live.
- **Each row has everything the seller needs on numastore, one tap from a copy button**: the product and plan, the link that opens this exact item on numastore, the customer's activation email if the product needs one, and the Kunji order number.
- **"Bought".** The seller enters the numastore order number and what they actually paid, and the order moves to *bought*. The amount starts filled in with the plan's listed supplier price, and the seller corrects it if numastore charged something different.
- **"numastore can't supply it".** One tap marks the product sold out, and moves the order to *refunded* once the seller records how the money was sent back (method and reference). Until then it sits in a "refunds to send" list.
- **What the customer sees.** *Paid* and *bought* both show as "Preparing your order". A refund shows as *refunded*, with the amount and method, live, and a line saying the item is out of stock.
- **The Telegram ping on approval** now says "bought needed" with the order number, so the next step is on the seller's phone the moment the payment is approved.
- An order waiting at *paid* for more than 30 minutes is marked in amber on the buy list.

## Constraints

- ***Bought* can't be saved without a numastore order number**, and a numastore order number can't be used on two Kunji orders. Both enforced by the database.
- **What the seller actually paid is recorded on the order**, separately from the plan's supplier price. If they differ, the plan's supplier price is not changed automatically; the seller is shown the difference and decides.
- **The app never opens, reads or logs in to numastore.** The link opens in the seller's browser. Buying is the seller's tap on numastore, not the app's.
- A refund can't exceed what the customer paid, and records method, reference, who and when.
- The numastore order number, link and amount paid are admin-only. A customer's query for their order never returns them.
- Waiting times are worked out from the order's events when read, not stored as a number that can go stale.

## Acceptance check

1. Approve a payment. The order appears on the buy list on your phone without a refresh, and a Telegram ping says it needs buying.
2. Tap the numastore link: the right item opens. Copy the activation email: it pastes correctly into numastore's checkout.
3. Mark it bought with a numastore order number and a price Rs 50 higher than listed. The order shows *bought*, the difference is shown, and the plan's supplier price hasn't changed on its own.
4. On a second order, try the same numastore order number. Refused.
5. On a third order, tap "numastore can't supply it" and record a refund. The product shows sold out on the storefront, and the customer's order page changes to *refunded* with the amount, live.
6. As the customer, look at the order in the browser's network tab. No numastore order number, link or price appears anywhere in the response.
7. Leave a paid order for 31 minutes (or set its approval time back in SQL). It turns amber on the buy list.

## Not in this phase

Putting the credentials into the customer's vault. A bought order sits at *bought* until the next phase. Any automation of buying on numastore.
