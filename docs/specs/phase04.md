# Phase 4 — The storefront

## Goal

A customer on a phone can see what's for sale, exactly what each thing is, and trust the store enough to want to buy.

## Where this starts

Products, plans and payment accounts can be entered by the seller in the admin area. The public side of the store is an empty shell.

## Build

- **The home page is the catalogue.** Products as cards, grouped by category, with a category filter and a search box. Each card shows the image, the name, the lowest price ("from Rs 800"), and the honest facts: account type, duration range, warranty, delivery time.
- **A product page.** The description, every plan with its duration, price and warranty, the honest facts in full, and how delivery works in one sentence ("Delivered to your vault by hand, usually within 30 minutes, 10am to midnight").
- **Badges that are facts.** "New" for products added in the last two weeks. "Sold out" when the seller has marked it so; a sold-out product stays visible but its plans can't be picked.
- **A "How it works" page**: the four steps from choosing to the vault, the payment methods accepted, and what happens if something goes wrong.
- **A warranty and refund policy page**, in plain words: what's covered, for how long, what isn't, and how refunds are paid back.
- A WhatsApp link in the footer of every page.
- Page titles and descriptions per product, so a shared link shows the product's name.

## Constraints

- **Phone first.** Every page is built and checked at 360 pixels wide before it's checked on a laptop. Large tap targets, the price readable at arm's length.
- **Light pages.** Images are resized and lazy-loaded. A product page loads quickly on a slow mobile connection.
- **The honest facts sit in the same place on every card and every product page**, next to the price, never below the fold or behind a tap.
- **No urgency that isn't true.** No countdowns, no "selling fast", no "only a few left", no viewer counts, no struck-through "original" prices. Kunji doesn't know numastore's stock count, so any number would be invented.
- **Nothing on the storefront mentions the supplier.** No numastore name, link, price or image anywhere a customer can see, including the page source.
- Prices come from the database on every request, never baked into a page that can go stale. Rendering a product page fires no request from the browser to fetch a price.
- Browsing never requires signing in.
- No buy button yet. The product page ends at the plans; checkout is the next phase.

## Acceptance check

1. Open the store on a phone (or the browser at 360 wide). Every card shows account type, duration, warranty and delivery time without tapping into it.
2. Change a plan's price in the admin area, reload the product page, and the new price is there.
3. Hide a product. It's gone from the catalogue and its page shows a plain "not available" page, not an error.
4. Mark a product sold out in the admin area. The card shows "Sold out" and its plans can't be picked. Search the product page's source for "numa". Nothing.
5. Search for part of a product's name and it's found. Filter by a category, and only that category shows.
6. Paste a product page link into WhatsApp. The preview shows the product's name.
7. Run Lighthouse on the product page in mobile mode. Performance and accessibility are green.

## Not in this phase

Checkout and the buy button. Reviews and ratings. Any marketing page beyond the two named here.
