"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { refresh } from "next/cache";
import { MALFORMED, failed, saved } from "@/lib/actions/results";
import { type FormState, formValues, idSchema, refusal } from "@/lib/catalogue";
import { hideReviewSchema, reviewSchema, reviewerFirstName } from "@/lib/reviews";
import { createServerSupabase } from "@/lib/supabase/server";

// Every write runs as the signed-in viewer. The database decides whether the
// order is theirs and was delivered, holds one review per order, and lets the
// seller hide a review but never change it. The browser sends stars and words;
// the name comes from the customer's Clerk account, read here.

export async function leaveReview(orderId: string, prev: FormState, formData: FormData): Promise<FormState> {
  const order = idSchema.safeParse(orderId);
  if (!order.success) return failed(MALFORMED, prev);
  const { userId } = await auth();
  if (!userId) return failed("Not saved: sign in again and retry.", prev);
  const parsed = reviewSchema.safeParse(formValues(formData));
  if (!parsed.success) return refusal(parsed.error, prev);

  const user = await currentUser();
  const supabase = await createServerSupabase();
  // Who wrote it is the database's to fill in, from the session; the name is
  // read from Clerk here, never taken from the form.
  const { error } = await supabase.rpc("leave_review", {
    p_order_id: order.data,
    p_rating: parsed.data.rating,
    p_comment: parsed.data.comment,
    // Left out when the account has no first name; the store says "Customer".
    p_reviewer_name: reviewerFirstName(user?.firstName) ?? undefined,
  });
  switch (error?.code) {
    case undefined:
      break;
    case "23505":
      return failed("You've already reviewed this order. Reload to edit your review.", prev);
    case "KJ011":
      return failed("This order hasn't been delivered, so it can't be reviewed yet.", prev);
    case "42501":
    case "23503":
      return failed("Not saved: this order isn't yours, or it no longer exists.", prev);
    default:
      return failed("Not saved. Try again.", prev);
  }

  refresh();
  return saved("Thanks, your review is up.", prev);
}

export async function editReview(reviewId: string, prev: FormState, formData: FormData): Promise<FormState> {
  const review = idSchema.safeParse(reviewId);
  if (!review.success) return failed(MALFORMED, prev);
  const parsed = reviewSchema.safeParse(formValues(formData));
  if (!parsed.success) return refusal(parsed.error, prev);

  const supabase = await createServerSupabase();
  // The policy only lets a customer reach their own review, so a row that
  // comes back empty is someone else's or gone.
  const { data, error } = await supabase
    .from("reviews")
    .update({ rating: parsed.data.rating, comment: parsed.data.comment })
    .eq("id", review.data)
    .select("id");
  if (error || data.length === 0) return failed("Not saved: this review isn't yours, or it no longer exists.", prev);

  refresh();
  return saved("Review updated.", prev);
}

export async function hideReview(reviewId: string, prev: FormState, formData: FormData): Promise<FormState> {
  const review = idSchema.safeParse(reviewId);
  if (!review.success) return failed(MALFORMED, prev);
  const parsed = hideReviewSchema.safeParse(formValues(formData));
  if (!parsed.success) return refusal(parsed.error, prev);

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("hide_review", { p_review_id: review.data, p_reason: parsed.data.reason });
  switch (error?.code) {
    case undefined:
      break;
    case "42501":
      return failed("Not saved: this account isn't an admin.", prev);
    case "P0002":
      return failed("Not saved: this review no longer exists.", prev);
    case "KJ006":
      return failed("This review is already hidden. Reload to see it.", prev);
    default:
      return failed("Not hidden. Nothing was changed; try again.", prev);
  }

  refresh();
  return saved("Hidden.", prev);
}
