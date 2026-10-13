import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HideReviewForm } from "@/components/admin/hide-review-form";
import { NotAdmin } from "@/components/admin/not-admin";
import { hideReview } from "@/lib/actions/reviews";
import { viewerSeesAdminRows } from "@/lib/data/admin";
import { listAdminReviews } from "@/lib/data/reviews";
import { formatDays, formatPakistanTime } from "@/lib/format";
import { reviewerLabel } from "@/lib/reviews";

export const metadata: Metadata = { title: "Reviews · Admin · Kunji" };

const linkClass = "text-link";

export default function ReviewsPage() {
  return (
    <main className="mt-3">
      <h1 className="font-heading text-xl leading-tight">Reviews</h1>
      <Suspense fallback={<p className="mt-1.5 text-muted-foreground">Loading…</p>}>
        <Reviews />
      </Suspense>
    </main>
  );
}

// Read-only on purpose: there is nowhere here to change a review's stars or
// words, and the database refuses it if anyone tries another way.
async function Reviews() {
  if (!(await viewerSeesAdminRows())) return <NotAdmin />;
  const reviews = await listAdminReviews();

  if (reviews.length === 0) return <p className="mt-1.5 text-muted-foreground">No reviews yet.</p>;

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 pr-3 font-medium">Order</th>
            <th className="py-1 pr-3 font-medium">Product</th>
            <th className="py-1 pr-3 font-medium">Stars</th>
            <th className="py-1 pr-3 font-medium">Comment</th>
            <th className="py-1 pr-3 font-medium">By</th>
            <th className="py-1 pr-3 font-medium">Written</th>
            <th className="py-1 font-medium">On the store</th>
          </tr>
        </thead>
        <tbody className="divide-y align-top">
          {reviews.map((review) => (
            <tr key={review.id} className={review.hidden_at ? "text-muted-foreground" : ""}>
              <td className="py-1 pr-3">
                <Link href={`/admin/orders/${review.orderNumber}`} className={`font-mono ${linkClass}`}>
                  #{review.orderNumber}
                </Link>
              </td>
              <td className="py-1 pr-3">
                {review.productName}
                <span className="block text-xs text-muted-foreground">{formatDays(review.duration_days)}</span>
              </td>
              <td className="py-1 pr-3 tabular-nums">{review.rating}/5</td>
              <td className="max-w-72 py-1 pr-3 whitespace-pre-line break-words">
                {review.comment || <span className="text-muted-foreground">—</span>}
              </td>
              <td className="py-1 pr-3">{reviewerLabel(review.reviewer_name)}</td>
              <td className="py-1 pr-3 whitespace-nowrap">
                {formatPakistanTime(review.created_at)}
                {review.updated_at !== review.created_at && (
                  <span className="block text-xs text-muted-foreground">
                    edited {formatPakistanTime(review.updated_at)}
                  </span>
                )}
              </td>
              <td className="py-1">
                {review.hidden_at ? (
                  <>
                    <span className="font-medium">Hidden</span> {formatPakistanTime(review.hidden_at)}
                    <span className="block text-xs">Reason: {review.hidden_reason}</span>
                  </>
                ) : (
                  <HideReviewForm action={hideReview.bind(null, review.id)} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
