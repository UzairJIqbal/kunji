import { editReview, leaveReview } from "@/lib/actions/reviews";
import type { OrderReview } from "@/lib/data/reviews";
import { formatPakistanDate } from "@/lib/format";
import { ReviewForm } from "./review-form";
import { Stars } from "./stars";

// On a delivered order: write a review, or see and edit the one written. A
// hidden review is still the customer's to see, with the fact it's off the store.
export function ReviewSection({ orderId, review }: { orderId: string; review: OrderReview | null }) {
  if (!review) {
    return (
      <section aria-labelledby="review-heading" className="mt-6 rounded-lg border bg-card p-4">
        <h2 id="review-heading" className="text-base font-semibold">
          Review this order
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">How did it go? Other customers will see it.</p>
        <div className="mt-4">
          <ReviewForm action={leaveReview.bind(null, orderId)} submitLabel="Post review" />
        </div>
      </section>
    );
  }

  const edited = review.updated_at !== review.created_at;
  return (
    <section aria-labelledby="review-heading" className="mt-6 rounded-lg border bg-card p-4">
      <h2 id="review-heading" className="text-base font-semibold">
        Your review
      </h2>
      <Stars rating={review.rating} className="mt-2 block text-lg" />
      {review.comment && <p className="mt-1 whitespace-pre-line break-words">{review.comment}</p>}
      <p className="mt-1 text-sm text-muted-foreground">
        Posted {formatPakistanDate(review.created_at)}
        {edited && `, edited ${formatPakistanDate(review.updated_at)}`}
      </p>
      {review.hidden_at && (
        <p className="mt-2 rounded-lg border px-3 py-2 text-sm">
          The seller has taken this review off the store, so it no longer shows there or counts in the
          rating.
        </p>
      )}
      <details className="mt-3 group">
        <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          Edit your review
        </summary>
        <div className="mt-3">
          <ReviewForm
            action={editReview.bind(null, review.id)}
            initial={{ rating: review.rating, comment: review.comment }}
            submitLabel="Save changes"
          />
        </div>
      </details>
    </section>
  );
}
