# Phase 12 — Payment matching from wallet SMS

Build this only after v1 has run with real orders and the reports show customers regularly waiting on payment approval.

## Goal

When a customer's money really arrives in the seller's wallet, their order is approved within a minute, even if the seller is asleep, and nothing less than an exact match is ever approved without the seller.

## Where this starts

Every payment is approved by hand from the verification queue. Easypaisa and JazzCash already send the seller an SMS for every payment received, with the amount, the sender and the transaction ID. Nothing reads them.

## Build

- **An endpoint that receives forwarded SMS.** A free Android SMS-forwarding app on the seller's phone sends each wallet SMS to it, with a long secret in the request. Anything without the secret is refused.
- **Every received SMS is stored**, admin-only, with the time it arrived and whether it was used.
- **A reader per wallet** that pulls the amount, transaction ID and sender's number out of the SMS text. Built and tested against real SMS the seller pastes in as samples.
- **Matching.** When an SMS is read and exactly one *verifying* order has the same transaction ID, the same amount and the same method, the order moves to *paid*. It works in either order: an SMS that arrives before the customer submits proof waits, and is matched when the proof comes in.
- **The order event says how it was approved**: "matched to wallet SMS", with a link to the stored message, so the seller can always see why.
- **An "unmatched payments" list** in the admin area: SMS that arrived and matched nothing. This is money that came in without an order, or with a typo in the transaction ID.
- **The Telegram ping on an automatic approval** says "paid automatically, needs buying", so the buy step starts straight away.
- **A switch to turn matching off.** Everything falls back to the v1 queue.

## Constraints

- **Exact or nothing.** Transaction ID, amount and method must all match, and exactly one order. Anything less (a near-match, two candidates, an unreadable SMS) approves nothing and leaves the order for the seller. A matcher that guesses is worse than no matcher.
- **Only SMS from the wallets' official sender names count.** The accepted sender names are a short list set by the seller. Anything else is stored and ignored. This is the defence against a fake SMS sent to the seller's phone.
- **An SMS can approve one order, once.** Forwarding apps retry; the same message arriving twice does nothing the second time.
- **The readers are pure functions** with the seller's real samples as tests. When a wallet changes its SMS wording, the reader fails to read, and nothing is approved. It never half-reads.
- The secret lives in the server's environment and in the forwarding app, nowhere else. It can be changed without a deploy breaking anything else.
- Stored SMS contain other people's phone numbers. Admin-only, and deleted after 90 days.
- No new paid service and no wallet merchant account. The only new piece is the free app on the seller's phone; name the one you suggest and wait before relying on it.

## Acceptance check

1. Have a friend send the exact amount for a real order and submit proof. The order turns *paid* within a minute without you touching it, and its timeline says "matched to wallet SMS".
2. Have them send Rs 10 less on another order. It stays in *verifying* for you to check.
3. Send the SMS to the endpoint a second time. Nothing changes.
4. Send a request to the endpoint without the secret. Refused.
5. Send a correctly worded SMS from a sender name not on the list. It's stored, marked ignored, and approves nothing.
6. Pay before submitting proof. The SMS waits, and the order is approved the moment the proof arrives.
7. Pay with no order at all. The payment shows in "unmatched payments".
8. Turn matching off and repeat step 1. The order waits in the queue.

## Not in this phase

Wallet merchant APIs. Reading SMS from banks. Automatic buying on numastore. Automatic refunds.
