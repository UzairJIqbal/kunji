import { type Rating, formatAverage, formatReviewCount, ratings, starsLabel } from "@/lib/reviews";

// Stars in the text colour: a rating isn't a status, so it gets no colour.
// The glyphs are hidden from screen readers, which hear the words instead.
export function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  return (
    <span role="img" aria-label={starsLabel(rating)} className={`tracking-tight ${className}`}>
      {ratings.map((n) => (
        <span key={n} aria-hidden className={n <= rating ? "" : "text-muted-foreground/40"}>
          ★
        </span>
      ))}
    </span>
  );
}

// The average to one decimal and how many reviews it's from, or plainly none:
// no stars at all rather than five empty ones that read as a bad score.
export function RatingSummary({ rating }: { rating: Rating }) {
  if (rating.average === null) {
    return <p className="text-sm text-muted-foreground">No reviews yet</p>;
  }
  return (
    <p className="text-sm">
      <span className="font-semibold tabular-nums">{formatAverage(rating.average)}</span>{" "}
      <span aria-hidden>★</span>
      <span className="sr-only"> out of 5</span>{" "}
      <span className="text-muted-foreground">({formatReviewCount(rating.count)})</span>
    </p>
  );
}
