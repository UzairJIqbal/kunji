# Phase 14 — Redesign

## Goal

Every screen of Kunji looks like `design/kunji-design.png`.

## Where this starts

Every feature works, but each screen was styled on its own as its phase was built. Nothing about what the app does changes in this phase, only how it looks.

## Build

- **Read the design first.** Open `design/kunji-design.png` and write down what it sets: colours, fonts, sizes, spacing, corner radius, borders, shadows, buttons, inputs, cards, badges, the header and the footer. Show me that list before changing any screen.
- **One set of design tokens** (colours, type sizes, spacing, radius) in the Tailwind theme, taken from that list. Screens use the tokens, never one-off values.
- **Restyle the shared pieces first** (buttons, inputs, cards, badges, header, navigation), then every storefront screen, then the customer's orders and vault, then the admin area.
- **Screens the image doesn't show** follow the same tokens and pieces, so they look like they belong to it.
- Use the frontend design skill to carry the design across screens, but where the skill and the image disagree, the image wins.

## Constraints

- **Looks only.** No change to what a page shows, the order of steps, any text the seller wrote, the database, policies or server code. If matching the image seems to need one of those, ask first.
- **Status colours keep their meaning.** Each order and ticket status keeps one colour everywhere; the image decides which shades.
- **Phone first.** Every screen is checked at 360 pixels wide before a laptop, with no sideways scrolling.
- **Admin stays a dense working tool.** It takes the image's colours and fonts but keeps small type, tight rows and monospace for order numbers and transaction IDs.
- **Nothing moves unless it was tapped.** No entrance animations, no autoplay, no heavy images, even if the image suggests them. The store opens on slow phone connections.
- **Text stays readable.** Text and its background keep at least WCAG AA contrast.
- If a font or package is needed, name it and wait before installing.

## Acceptance check

1. Put the home page on a laptop next to `design/kunji-design.png`. Colours, fonts, buttons, cards and spacing match.
2. Open the home page, a product page, checkout, my orders and the vault at 360 pixels wide. Each looks like the design and nothing scrolls sideways.
3. Walk one order from checkout to delivery as before. Every step still works and every status shows its usual colour.
4. Open the admin queue, buy list, stock and reports. They use the new colours and fonts but are still dense, with monospace order numbers.
5. Reload a few pages. Nothing slides or fades in on its own.

## Not in this phase

New features, new pages, changed wording, a logo or brand change the image doesn't show, dark mode unless the image shows it.
