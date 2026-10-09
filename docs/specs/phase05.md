# Phase 5 — Checkout and payment proof

## Goal

A customer picks a plan, pays from their wallet, and submits proof, and the store records exactly what they ordered at exactly the price it was.

## Where this starts

The public catalogue and product pages from Phase 4, and the payment accounts the seller entered in Phase 3. There's no buy button yet.

## Build

- **A buy button on each plan**, except on sold-out products. Signed-out customers are sent to sign in and come back to the same plan.
- **Checkout, one screen at phone width.** The product, plan, duration, warranty and price restated. The activation email, if the product needs one, typed twice and refused if the two don't match. The customer's WhatsApp number, asked once and remembered on their profile.
- **Placing the order** creates it in *awaiting payment*, with its price copied from the plan, and an expiry two hours out.
- **The payment screen.** At the top, large: "Your Canva Pro will be activated on ali@gmail.com", with a link back to fix it. The customer picks a method from the seller's active payment accounts and sees the account title, the account number with a copy button, and the exact amount to send. Then three fields: the transaction ID, the wallet number they paid from (needed for any refund), and a receipt image. Submitting moves the order to *verifying*.
- **The order page.** Order number, product, plan, price, status, and a timeline drawn from the order's events. A WhatsApp link with the order number already filled in.
- **The account area's order list** fills in, newest first, with each order's status in its status colour.
- **An unpaid order past its expiry shows as expired**, drops out of the list of open orders, and says "Already paid? Submit your proof anyway." Proof on an expired order is accepted and moves it to *verifying*.

## Constraints

- **The price comes from the database, not the browser.** The browser sends which plan; one database function reads the price and creates the order. Editing the request in the browser can't change what anything costs.
- **A transaction ID can be used once per payment method.** Enforced by a unique constraint in the database, not a check in the app that runs first. A reused ID gets a clear message: this transaction ID has already been used.
- **Submitting proof never makes an order paid.** It moves to *verifying* and stops there. Only the seller moves it on.
- Receipts go to a private storage bucket, readable only by the customer who uploaded them and by admins. Images only, with a size limit.
- **Expiry tidies, it never refuses money.** Kunji holds no stock, so nothing is lost by accepting late proof, and a customer who paid at the last minute must never be locked out. Expiry is worked out when it's read. No scheduled job.
- A customer can have at most three unexpired orders awaiting payment at once. A fourth gets a plain message. Limits like this live in the database, not a separate service.
- The transaction ID and order number are shown in monospace everywhere.

## Acceptance check

1. Sign out, tap buy on a plan, sign in, and you're back on checkout for that plan.
2. Place an order. Using the browser's tools, resend the create-order request with a lower price in it. The order still has the plan's real price.
3. Submit proof with a transaction ID. Place a second order and submit the same transaction ID for the same method. It's refused with the "already used" message.
4. After submitting proof, the order shows *verifying*, not paid, and the timeline shows when proof was submitted.
5. Signed in as a different customer, try to open the first customer's order page and their receipt link. Neither loads.
6. Set an order's expiry into the past in the database. The order page shows it as expired with "Already paid? Submit your proof anyway". Submit proof, and it moves to *verifying*.
7. At checkout, type two different activation emails. It's refused. Type the same one twice, and the payment screen shows it large at the top.
8. Try to submit proof without the wallet number you paid from. It's refused.

## Not in this phase

The seller's side of verification. Live status updates. Buying from numastore. Delivery of any kind.
