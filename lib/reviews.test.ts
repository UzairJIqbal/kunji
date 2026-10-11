import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatAverage,
  formatReviewCount,
  hideReviewSchema,
  ratingAverage,
  reviewSchema,
  reviewerFirstName,
  reviewerLabel,
  starsLabel,
} from "./reviews.ts";

test("no reviews is no average, not zero", () => {
  assert.equal(ratingAverage(0, 0), null);
});

test("the average is to one decimal", () => {
  assert.equal(ratingAverage(9, 2), 4.5);
  assert.equal(ratingAverage(5, 1), 5);
  assert.equal(formatAverage(ratingAverage(8, 2) ?? 0), "4.0");
});

test("the average is never rounded up", () => {
  // 4.97 and 4.666… both stay below the next tenth.
  assert.equal(ratingAverage(497, 100), 4.9);
  assert.equal(ratingAverage(14, 3), 4.6);
  assert.equal(ratingAverage(29, 6), 4.8);
});

test("the average isn't pushed down a tenth by floating point", () => {
  assert.equal(ratingAverage(43, 10), 4.3);
  assert.equal(ratingAverage(129, 30), 4.3);
});

test("the average refuses what isn't a count", () => {
  assert.throws(() => ratingAverage(4.5, 1));
  assert.throws(() => ratingAverage(4, -1));
});

test("counts and stars read as words", () => {
  assert.equal(formatReviewCount(1), "1 review");
  assert.equal(formatReviewCount(12), "12 reviews");
  assert.equal(starsLabel(1), "1 star out of 5");
  assert.equal(starsLabel(4), "4 stars out of 5");
});

test("the reviewer's name is their first name only", () => {
  assert.equal(reviewerFirstName("  Ayesha Khan "), "Ayesha");
  assert.equal(reviewerFirstName("Ali"), "Ali");
  assert.equal(reviewerFirstName("x".repeat(60))?.length, 40);
});

test("no first name shows as Customer", () => {
  assert.equal(reviewerFirstName(null), null);
  assert.equal(reviewerFirstName("   "), null);
  assert.equal(reviewerLabel(null), "Customer");
  assert.equal(reviewerLabel("Ali"), "Ali");
});

test("a review is 1 to 5 stars and an optional short comment", () => {
  assert.deepEqual(reviewSchema.parse({ rating: "4" }), { rating: 4, comment: "" });
  assert.deepEqual(reviewSchema.parse({ rating: "5", comment: "  Works well " }), {
    rating: 5,
    comment: "Works well",
  });
  assert.equal(reviewSchema.safeParse({}).success, false);
  assert.equal(reviewSchema.safeParse({ rating: "0" }).success, false);
  assert.equal(reviewSchema.safeParse({ rating: "6" }).success, false);
  assert.equal(reviewSchema.safeParse({ rating: "4.5" }).success, false);
  assert.equal(reviewSchema.safeParse({ rating: "4", comment: "x".repeat(501) }).success, false);
});

test("hiding needs a reason", () => {
  assert.equal(hideReviewSchema.safeParse({ reason: "  " }).success, false);
  assert.deepEqual(hideReviewSchema.parse({ reason: " Abusive " }), { reason: "Abusive" });
});
