# Phase 10 — Reviews

## Goal

Customers who really bought something can say how it went, and every rating on the store came from a real delivered order.

## Where this starts

Orders are bought, delivered, replaced and refunded with a full record. Product pages show no ratings.

## Build

- **Leave a review** from a delivered or replaced order: one to five stars and an optional short comment. One review per order. The customer can edit their own review.
- **Ratings on the storefront.** The average and the count on every product card and product page, and the reviews listed on the product page, newest first, with the reviewer's first name and the plan they bought.
- **The seller can hide a review** that's abusive or contains personal details, with a reason recorded. Hidden reviews stop counting in the average.
- A product with no reviews shows "No reviews yet", not zero stars.

## Constraints

- **A review exists only because of a delivered order.** The database refuses a review for an order that isn't the customer's, or wasn't delivered. No seeded reviews, no imported reviews, no reviews the seller writes.
- **The seller can hide, never edit.** Changing a customer's words or stars would make every rating a maybe.
- The average shown is worked out from the visible reviews at render time, to one decimal. No rounding up.
- Reviews from refunded orders still count. A refund is part of how it went.

## Acceptance check

1. Review a delivered order. The product page shows the review and the average updates.
2. Try to review an order still in *verifying*, by calling the database directly. It's refused.
3. Try to review the same order twice. The second is refused, and editing the first works.
4. As the seller, hide a review. It's gone from the product page and the average and count change to match.
5. Look for any way in the admin area to change a review's text or stars. There isn't one.

## Not in this phase

Photos in reviews. Replies from the seller. Reviews of the store as a whole.
