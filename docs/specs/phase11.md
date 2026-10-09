# Phase 11 — Reports

## Goal

The seller can see whether the flat margin is actually making money after refunds and replacements, and where orders get stuck in the pipeline.

## Where this starts

Every order carries the customer's price, what the seller actually paid numastore, and any refund or replacement cost. None of it is added up anywhere.

## Build

- **A reports page in the admin area**, for a chosen period (this week, this month, last month, all time).
- **Sales.** Orders delivered, revenue, what was paid to numastore, and profit in rupees and as a percentage, in total and per product.
- **Real margin against planned margin.** Per product, the margin the plan promised against what was actually made once numastore's real price is in. Products where numastore's price went up and the plan wasn't updated sit at the top.
- **Refunds and replacements.** How many, what they cost the seller, and how many replacements numastore covered versus how many the seller paid for, per product.
- **Profit after everything.** Revenue minus numastore costs, refunds and paid-for replacements. This is the number the reseller report was worried about.
- **The pipeline's waiting times.** The median and the slowest time for each step: proof submitted to approved, approved to bought, bought to delivered. And how many customers waited over 30 minutes in total.
- **Out-of-stock refunds** per product, so the items numastore keeps running out of are visible.
- An export of the period's orders as a CSV: order number, date, product, plan, price, numastore cost, refund, replacement cost, status. No credentials, no customer contact details.

## Constraints

- **Every number is arithmetic over recorded rows**, worked out by a database query or a pure function, never estimated or projected. No forecasts.
- Profit uses what the seller actually paid numastore, recorded at buying time, not the plan's current supplier price. Changing a plan today doesn't rewrite last month.
- A replacement's or refund's cost counts in the period it happened.
- Admin-only, through the same policies as everything else. Nothing on this page is reachable by a customer's session.
- No charts that need a new package. Tables first; if a chart is worth it, ask.
- Times shown in Pakistan time.

## Acceptance check

1. Pick three delivered orders and add up revenue, numastore cost and profit by hand. The report for a period holding only those three matches to the rupee.
2. Refund one of them. Profit after everything drops by the refund amount, and the refund count goes up by one.
3. Mark an order bought at Rs 100 more than the plan's supplier price. Its product's real margin shows Rs 100 below the planned margin.
4. Change a plan's supplier price, reload last period's report, and the profit hasn't changed.
5. Export the CSV and open it. No column contains a credential, an email or a phone number.
6. Signed in as a customer, call the report query directly. Nothing comes back.

## Not in this phase

Forecasts or targets. Accounting or tax figures. Charts that need a library.
