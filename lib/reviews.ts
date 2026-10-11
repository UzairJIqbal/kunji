import { z } from "zod";
// Relative, with its extension, so the tests can load this file directly.
import { requiredText } from "./catalogue.ts";

// ───────────────────────────── The average ─────────────────────────────

export type Rating = { average: number | null; count: number };

// The mean of the visible reviews, cut to one decimal and never rounded up:
// 4.97 is shown as 4.9, not 5.0. Worked in tenths, as whole numbers, so a
// float can't nudge 4.3 down to 4.2. None at all is no average, not zero.
export function ratingAverage(total: number, count: number): number | null {
  for (const value of [total, count]) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`Not a whole number: ${value}`);
  }
  if (count === 0) return null;
  return Math.floor((total * 10) / count) / 10;
}

export function formatAverage(average: number): string {
  return average.toFixed(1);
}

export function formatReviewCount(count: number): string {
  return count === 1 ? "1 review" : `${count} reviews`;
}

// Read out in place of the star glyphs, which are hidden from screen readers.
export function starsLabel(rating: number): string {
  return rating === 1 ? "1 star out of 5" : `${rating} stars out of 5`;
}

// ───────────────────────────── The reviewer ─────────────────────────────

// What the store shows beside a review: the first word of the first name the
// customer's account has, as the database will hold it. Nothing they type.
export function reviewerFirstName(raw: string | null | undefined): string | null {
  const first = raw?.trim().split(/\s+/)[0] ?? "";
  if (first === "") return null;
  return Array.from(first).slice(0, 40).join("").trim() || null;
}

export function reviewerLabel(name: string | null): string {
  return name ?? "Customer";
}

// ───────────────────────────── Forms ─────────────────────────────

export const ratings = [1, 2, 3, 4, 5] as const;

// Stars come from five radios, so anything but "1" to "5" is a forged form.
export const reviewSchema = z.object({
  rating: z
    .enum(["1", "2", "3", "4", "5"], { error: "Choose from 1 to 5 stars" })
    .transform(Number),
  comment: z
    .string({ error: "The comment must be text" })
    .trim()
    .max(500, "The comment is at most 500 characters")
    .default(""),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export const hideReviewSchema = z.object({
  reason: requiredText("Reason", 300),
});
