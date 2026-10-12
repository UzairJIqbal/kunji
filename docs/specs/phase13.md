# Phase 13 — A small stock of best sellers

Build this only once the reports show which products sell steadily enough to be worth buying in advance.

## Goal

For the few products the seller keeps in stock, a paid order goes straight into the customer's vault, so the customer gets it the moment the seller approves the payment, with no buying step in between.

## Where this starts

Every order is bought on numastore by hand after payment, from the buy list. The seller is notified of every new payment (Phase 12) and approves it from the queue.

## Build

- **Stock for a plan.** On a plan's admin page, the seller adds credentials they've already bought on numastore, one per line, each with its numastore order number, what it cost, and the date it stops working. Each line is encrypted on the way in.
- **Only for plans that hand over a login.** Plans that need the customer's activation email can't be stocked, because they're bought for that specific email. The form refuses them.
- **Duplicates caught at upload**, by a fingerprint of the credential, never by comparing plain text. The rejected line is named by its line number only.
- **Delivered on approval.** When a paid order is for a plan with free stock, one item is taken, the order passes through *bought* (using the stock item's numastore order number and cost) and *delivered*, and the login lands in the vault. All in one step, the moment the seller approves.
- **No stock, no change.** When a plan's stock is empty, its paid orders go to the buy list exactly as in v1.
- **Honest delivery time.** A plan with free stock shows "Instant delivery" instead of "within 30 minutes". The stock count itself is never shown to customers.
- **A stock page in the admin area.** For each stocked plan: free, delivered, and how many days the oldest free item has left.

## Constraints

- **Taking an item happens inside one database function that locks the row it picks.** Two orders approved in the same second never get the same login.
- **Approval and delivery are one transaction.** Either the order is paid, bought, delivered and the item used, or none of it happened.
- **The vault shows the item's real expiry date**, the one the seller entered, not the plan's duration counted from delivery. A login bought three weeks ago has three weeks less left, and the customer is told so on the product page before buying ("at least 11 months left").
- **Items close to running out aren't sold.** An item with less than 90% of the plan's duration left is held back for the seller to decide. Selling a "12 month" plan that has 7 months left breaks the rule about listings.
- Stock credentials follow every credential rule: encrypted, never logged, never echoed back, revealed only on tap.
- Nothing in this phase touches numastore. The seller still buys stock there by hand.

## Acceptance check

1. Add three logins to a plan, one repeated. Two are added, and the repeat is refused by line number without showing it.
2. Try to add stock to a plan that needs an activation email. Refused.
3. Pay for the stocked plan and approve the payment. The login is in the vault straight away, and the timeline shows paid, bought and delivered.
4. Approve two orders for a plan with one item left, at the same moment (two windows, or a script calling the approval twice). One is delivered; the other lands on the buy list. The item is in exactly one vault.
5. Use up the stock. The product page goes back to "within 30 minutes", and the stock page shows it ran out.
6. Add an item that expires sooner than 90% of the plan's duration. It's held back, not sold.
7. Read the stock table in the Supabase dashboard. Every credential is unreadable.

## Not in this phase

Buying stock on numastore automatically. Stock for activation-email products. Showing stock counts to customers.
