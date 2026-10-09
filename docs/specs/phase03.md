# Phase 3 — Catalogue admin

## Goal

The seller can list what they resell from numastore, priced at the supplier's price plus their margin, with honest facts and the margin's real size visible on every plan.

## Where this starts

The schema and policies from Phase 2, with seeded products. The admin area shows order counts and nothing else.

## Build

- **A product list in the admin area**, dense: name, category, plan count, active, hidden or sold out, and how long since the supplier price was last checked.
- **A product form.** Name, category, short description in the seller's own words, setup instructions, an image the seller uploads, and the honest facts: account type (your own account, a shared slot, or an invite to your email), any region or plan note, and whether it needs an activation email from the customer.
- **Plans under each product.** Duration, warranty days, the numastore price, the margin in rupees (the form starts at Rs 150), and the link to this exact item on numastore. The sell price is shown, worked out, never typed. Beside it, the margin as a percentage, updating as the numbers are typed.
- **"Price checked" on each plan.** One tap records that the seller just looked at numastore and the price is still right. Plans not checked for a week show the date in amber in the product list.
- **Sold out.** One tap marks a product sold out at the supplier, and one tap brings it back.
- Hiding a product takes it off the storefront without deleting it or any order that references it.
- Product images stored in Supabase Storage, in a bucket anyone can read.
- **Payment accounts.** The seller adds, edits and switches off the wallet and bank accounts customers will pay into: method, account title, account number.

## Constraints

- The honest facts are required. A product can't be saved without an account type, and every plan needs a duration and a warranty (zero is allowed, and shown as "no warranty").
- **The margin is the seller's choice, in rupees, as the business plan says.** The percentage is there so the seller sees what Rs 175 really means on each item. A plan whose margin is under 10% of its price shows the percentage in amber. It doesn't block saving.
- **No text or images copied from numastore**, and nothing in this phase fetches anything from numastore. The link is stored and opened by the seller, never read by the app.
- Every write goes through the admin's own session and the policies from Phase 2. No service key, no admin check written in application code.
- Every value from the form is validated on the server. The browser's validation is a convenience, not a guard.

## Acceptance check

1. Add a product with two plans: one at a numastore price of Rs 400 with a Rs 175 margin, one at Rs 2,000 with Rs 175. The sell prices show Rs 575 and Rs 2,175, the first margin shows about 30%, and the second shows about 8% in amber.
2. Try to save a product with no account type. It's refused with a message saying which field.
3. Tap a plan's numastore link. It opens the item on numastore in a new tab.
4. Mark a product sold out, then bring it back. Hide another; its seeded orders still show in the account area.
5. Set a plan's last-checked date to ten days ago in SQL. The product list shows it in amber. Tap "price checked" and it clears.
6. Signed in as a customer, ask the database for plan supplier details and for hidden products. Neither comes back.

## Not in this phase

The storefront that shows these products. Discounts or sale prices. Any automatic reading of numastore's prices or stock.
