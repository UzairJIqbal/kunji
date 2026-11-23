import { HOW_IT_WORKS_STEPS } from "@/lib/storefront";

// The four steps as a numbered list. The heading level is the page's to pick:
// they're the page's sections on /how-it-works, and sit under "How Kunji works"
// on the home page.
export function HowItWorksSteps({ stepHeading: Heading }: { stepHeading: "h2" | "h3" }) {
  return (
    <ol className="mt-5 grid gap-4">
      {HOW_IT_WORKS_STEPS.map((step, i) => (
        <li key={step.title} className="flex gap-3">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-sm font-semibold tabular-nums"
          >
            {i + 1}
          </span>
          <div className="max-w-prose">
            <Heading className="font-heading text-lg">{step.title}</Heading>
            <p className="mt-0.5 text-muted-foreground">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
