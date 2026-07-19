"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@moraqat/ui";
import { api, type CensusSnapshot } from "@/lib/api";

/**
 * The live census count (MRC-GTM-001 §1) — the number Phase 0 exists to move.
 *
 * The one rule: **it shows what the database says.** No floor, no rounding, no
 * "1,000+", no animated count-up from a fake starting number. If seven cats
 * are registered it says seven, and that honesty is the campaign, not a
 * compromise of it (R040, R006).
 *
 * When the count can't be fetched it says so plainly rather than rendering a
 * zero — a zero would be a lie about the world, where "we can't reach the
 * counter" is the truth about us (R112: every error is a recovery, and R111:
 * the empty state is a welcome, not a void).
 */

export function useCensus() {
  return useQuery({
    queryKey: ["census"],
    queryFn: () => api.census(),
    // The server memoises for 30s and sets s-maxage=30; matching that here
    // keeps a tab open on the hero from re-counting on every focus.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

/** Latin digits with locale grouping — the number is an identifier people read aloud. */
function formatCount(n: number, isAr: boolean) {
  return new Intl.NumberFormat(isAr ? "ar-SA-u-nu-latn" : "en-US").format(n);
}

interface CensusCounterProps {
  isAr: boolean;
  t: {
    counterLabel: string;
    counterLabelOne: string;
    counterLoading: string;
    counterUnavailable: string;
  };
  /** "hero" is the inline chip beside the CTA; "strip" is the big standalone number. */
  variant?: "hero" | "strip";
  className?: string;
}

export function CensusCounter({ isAr, t, variant = "hero", className }: CensusCounterProps) {
  const { data, isLoading, isError } = useCensus();
  const reduced = useReducedMotion();

  if (isLoading) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)} aria-live="polite">
        {t.counterLoading}
      </p>
    );
  }

  if (isError || !data) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)} aria-live="polite">
        {t.counterUnavailable}
      </p>
    );
  }

  const count = data.registered;
  const label = count === 1 ? t.counterLabelOne : t.counterLabel;
  const formatted = formatCount(count, isAr);

  if (variant === "strip") {
    return (
      <motion.p
        initial={reduced ? false : { opacity: 0, y: 8 }}
        whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={cn("flex flex-col items-center gap-2", className)}
      >
        {/* The digits run LTR in both locales: this is an identifier-style
            figure, and the rest of the Cat ID surface renders numbers the same
            way. Mixing numeral direction for the same fact costs recognition. */}
        <span dir="ltr" className="font-display text-6xl font-semibold tabular tracking-tight sm:text-7xl">
          {formatted}
        </span>
        <span className="text-base text-muted-foreground">{label}</span>
      </motion.p>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm shadow-e1",
        className
      )}
      aria-live="polite"
    >
      <span aria-hidden className="size-1.5 rounded-full bg-success" />
      <span dir="ltr" className="font-semibold tabular">{formatted}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

/**
 * The founding-cohort statement. States the real cohort size and, when it is
 * full, says so — but never counts down the remaining places. "Only 43 spots
 * left!" is exactly the manufactured urgency the brand refuses (R006), and the
 * reader can subtract two published numbers themselves if they care to.
 */
export function FoundingNote({
  data,
  isAr,
  t,
  className,
}: {
  data: CensusSnapshot | undefined;
  isAr: boolean;
  t: { foundingTitle: string; foundingBody: string; foundingClosed: string; latestPrefix: string };
  className?: string;
}) {
  if (!data) return null;
  return (
    <div className={cn("text-center", className)}>
      <h3 className="font-display text-2xl font-semibold tracking-tight">{t.foundingTitle}</h3>
      <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-muted-foreground">
        {data.foundingClosed ? t.foundingClosed : t.foundingBody}
      </p>
      {/* The most recent cat whose owner chose to be public — "Cat #347 is
          Lulu" (§1). Private cats are never named here; consent is the gate. */}
      {data.latestPublicCatName && data.latestPublicCatNumber !== null && (
        <p className="mt-5 text-sm text-muted-foreground">
          {t.latestPrefix}{" "}
          <span className="font-medium text-foreground">
            {data.latestPublicCatName}
          </span>{" "}
          <span dir="ltr" className="tabular">
            {isAr ? `— رقم ${data.latestPublicCatNumber}` : `— #${data.latestPublicCatNumber}`}
          </span>
        </p>
      )}
    </div>
  );
}
