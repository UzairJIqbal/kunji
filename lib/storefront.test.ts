import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterCatalogue,
  groupByCategory,
  isNew,
  summarisePlans,
  warrantyRange,
  whatsappLink,
} from "./storefront.ts";

const day = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-10T12:00:00Z");

test("a product is new for two weeks after it's added, and not a moment longer", () => {
  assert.equal(isNew(new Date(now.getTime() - 13 * day), now), true);
  assert.equal(isNew(new Date(now.getTime() - 14 * day + 1), now), true);
  assert.equal(isNew(new Date(now.getTime() - 14 * day), now), false);
  assert.equal(isNew(new Date(now.getTime() - 40 * day), now), false);
});

test("the summary gives the lowest price and the range of durations and warranties", () => {
  const summary = summarisePlans([
    { duration_days: 90, warranty_days: 30, sell_price: 2400 },
    { duration_days: 30, warranty_days: 7, sell_price: 900 },
    { duration_days: 365, warranty_days: 30, sell_price: 8000 },
  ]);
  assert.deepEqual(summary, {
    lowestPrice: 900,
    pricesVary: true,
    duration: "30–365 days",
    warranty: "7–30 days",
  });
});

test("one plan reads as one price and one duration, with no 'from'", () => {
  const summary = summarisePlans([{ duration_days: 30, warranty_days: 30, sell_price: 800 }]);
  assert.deepEqual(summary, {
    lowestPrice: 800,
    pricesVary: false,
    duration: "30 days",
    warranty: "30 days",
  });
});

test("a product with no priced plans has no summary", () => {
  assert.equal(summarisePlans([]), null);
});

test("no warranty is said plainly, never as zero days", () => {
  assert.equal(warrantyRange(0, 0), "None");
  assert.equal(warrantyRange(0, 30), "Up to 30 days");
  assert.equal(warrantyRange(1, 1), "1 day");
});

const products = [
  { name: "ChatGPT Plus", category: "AI" },
  { name: "Canva Pro", category: "Design" },
  { name: "Claude Pro", category: "AI" },
];

test("search finds part of a name, ignoring case and spaces", () => {
  const found = filterCatalogue(products, { query: "chat gpt", category: "" });
  assert.deepEqual(found.map((p) => p.name), ["ChatGPT Plus"]);
  assert.deepEqual(
    filterCatalogue(products, { query: "PRO", category: "" }).map((p) => p.name),
    ["Canva Pro", "Claude Pro"],
  );
});

test("a category filter shows only that category, and combines with search", () => {
  assert.deepEqual(
    filterCatalogue(products, { query: "", category: "AI" }).map((p) => p.name),
    ["ChatGPT Plus", "Claude Pro"],
  );
  assert.deepEqual(
    filterCatalogue(products, { query: "pro", category: "AI" }).map((p) => p.name),
    ["Claude Pro"],
  );
  assert.deepEqual(filterCatalogue(products, { query: "", category: "Ai" }), []);
});

test("grouping keeps the order products arrived in", () => {
  assert.deepEqual(
    groupByCategory(products).map((g) => [g.category, g.products.map((p) => p.name)]),
    [
      ["AI", ["ChatGPT Plus", "Claude Pro"]],
      ["Design", ["Canva Pro"]],
    ],
  );
});

test("a WhatsApp link is built only from digits", () => {
  assert.equal(whatsappLink("923001234567"), "https://wa.me/923001234567");
  assert.throws(() => whatsappLink("+92 300 1234567"));
});
