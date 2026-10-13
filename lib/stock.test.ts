import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_STOCK_LINES,
  describeLineProblems,
  pakistanDateKey,
  parseStockLines,
  stockTimeLeft,
  wholeDaysLeft,
} from "./stock.ts";

const today = "2026-10-12";

test("each line becomes an item carrying its own line number", () => {
  const { items, problems } = parseStockLines(
    "a@x.com | pw1 | NS-1 | 900 | 2027-10-01\n\nb@x.com|pw2|ns 2|950|2027-09-30\n",
    today,
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(items, [
    { line: 1, login: "a@x.com", password: "pw1", supplierOrderNumber: "NS-1", cost: 900, expiresOn: "2027-10-01" },
    { line: 3, login: "b@x.com", password: "pw2", supplierOrderNumber: "NS2", cost: 950, expiresOn: "2027-09-30" },
  ]);
});

test("a password may contain the separator", () => {
  const { items } = parseStockLines("a@x.com | p|w|d | NS-1 | 900 | 2027-10-01", today);
  assert.equal(items[0].password, "p|w|d");
});

test("a bad line is named by its number and never quoted", () => {
  const text = [
    "a@x.com | secret-one | NS-1 | 900 | 2027-10-01",
    "b@x.com | secret-two | NS-2 | 9.5 | 2027-10-01",
    "c@x.com | secret-three | NS-3 | 900 | 2027-02-30",
    "d@x.com | secret-four | NS-4 | 900 | 2026-10-12",
    "e@x.com secret-five",
  ].join("\n");
  const { items, problems } = parseStockLines(text, today);
  assert.equal(items.length, 1);
  assert.deepEqual(
    problems.map((p) => p.line),
    [2, 3, 4, 5],
  );
  const said = describeLineProblems(problems);
  assert.match(said, /^line 2: cost must be a whole number/);
  for (const word of ["secret", "@x.com", "NS-"]) assert.ok(!said.includes(word));
});

test("an empty paste or too many lines is refused whole", () => {
  assert.equal(parseStockLines(" \n ", today).problems[0].problem, "Paste at least one line");
  const many = Array.from({ length: MAX_STOCK_LINES + 1 }, (_, i) => `a${i} | p | N${i} | 1 | 2027-01-01`).join("\n");
  const parsed = parseStockLines(many, today);
  assert.equal(parsed.items.length, 0);
  assert.equal(describeLineProblems(parsed.problems), `At most ${MAX_STOCK_LINES} lines at a time`);
});

test("today is the Pakistan date, not the server's", () => {
  // 20:00 UTC is already the next day in Pakistan.
  assert.equal(pakistanDateKey(new Date("2026-10-12T20:00:00Z")), "2026-10-13");
});

test("time left counts whole days down, and months down", () => {
  const now = new Date("2026-10-12T00:00:00Z");
  const at = (days: number) => new Date(now.getTime() + days * 86_400_000);
  assert.equal(wholeDaysLeft(at(10.9), now), 10);
  assert.equal(wholeDaysLeft(at(-1), now), 0);
  assert.equal(stockTimeLeft(at(27.5), now), "at least 27 days left");
  assert.equal(stockTimeLeft(at(59), now), "at least 59 days left");
  assert.equal(stockTimeLeft(at(60), now), "at least 60 days left");
  assert.equal(stockTimeLeft(at(61), now), "at least 2 months left");
  assert.equal(stockTimeLeft(at(340), now), "at least 11 months left");
  assert.equal(stockTimeLeft(at(365), now), "at least 12 months left");
});
