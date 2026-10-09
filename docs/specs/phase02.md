# Phase 2 — Schema and policies

## Goal

The data the store runs on exists, every row has an owner, and the database itself decides who may read it.

## Where this starts

Sign-in and the shell from Phase 1. The admin and account areas are empty.

## Build

- **The first migration.** Tables for: customer profiles (name, WhatsApp number), admins, products, plans (each product has one or more: duration, warranty days, sell price), plan supplier details (supplier price, margin, the link to the same item on numastore, when the price was last checked), payment accounts (the seller's own wallet and bank numbers shown at checkout), orders, payments (method, transaction ID, the wallet number it was sent from, receipt), supplier purchases (supplier name, the numastore order number, what the seller actually paid), and order events (every status change, who made it and when).
- **Row-level security on every table**, written as database policy. A customer reads their own profile, orders, payments and order events. Anyone, signed in or not, reads active products, their plans and the active payment accounts. Only an admin reads or writes everything else.
- **Who is an admin is a row in the admins table**, read by the policies through one function. The first admin is added by hand in a migration or a one-off SQL statement, not through the app.
- **Supplier details live in their own tables** that only admins can read: supplier price, margin, numastore link and numastore order numbers. None of it can reach a customer's browser by accident.
- **A plan's sell price is the supplier price plus the margin**, worked out in the database, never stored as a third number someone can type.
- **A numastore order number can be used once.** A unique constraint in the database.
- **The order's states and the allowed moves between them**, defined once in the database, as the project doc lists them. A move that isn't allowed fails in the database. Every allowed move writes an order event.
- **A check that lists every table without row-level security and fails if there are any.** It runs from the terminal now and in CI later.
- Seeded rows: two products with plans and supplier details, one payment account, and orders in different states belonging to two different customers.
- The admin area shows a plain count of orders in each state. The account area lists the signed-in customer's orders. Both are deliberately bare; they exist to prove the policies.

## Constraints

- Authorization is a property of the database, not a check the application remembers to perform. No table is readable without a policy on it.
- **Row-level security is on by default, not per table.** A forgotten table returns everything silently; that has to be impossible, not unlikely.
- Migrations are files in version control, not changes made by hand in the dashboard.
- Money is whole rupees in integer columns. No floats, no decimals.
- An order keeps the price it was placed at, copied onto the order, not read back from the plan later.
- The account area does not filter by user in application code. If it shows someone else's order, the bug is the policy.

## Acceptance check

1. Signed in as the first seeded customer, the account area lists only their orders. Sign in as the second, and the list changes with no code change between them.
2. Signed in as a customer, ask the database directly from the browser's client for every order. Only that customer's orders come back. Ask for supplier details and supplier purchases. Nothing comes back.
3. Signed in as the admin, the admin area shows counts that add up to every seeded order.
4. Run the row-level security check. It passes, listing every table it looked at. Create a throwaway table without security in a scratch migration, run it again, and it fails naming that table.
5. Try to move a seeded order from awaiting payment straight to delivered with a SQL statement. The database refuses. Try to move a paid order to bought without a numastore order number. Refused too.
6. Change a seeded plan's margin in SQL. Its sell price changes with it.

## Not in this phase

Any form for adding products. The storefront. Checkout. The vault, tickets and reviews, which add their own tables in their own phases.
