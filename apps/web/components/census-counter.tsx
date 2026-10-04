"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@moraqat/ui";
import { api, type CensusSnapshot } from "@/lib/api";
import { formatNumber } from "@moraqat/core";

/**
 * The live census count (MRC-GTM-001 §1) — the number Phase 0 exists to move.
 *
 * The one rule: **it shows what the database says.** No floor, no rounding, no
 * "1,000+", no animated count-up from a fake starting number. If seven cats
 * are registered it says seven, and that honesty is the campaign, not a
 * compromise of it (R040, R006).
 *
 * When the count can't be fetched — or hasn't arrived yet (a cold API start
 * can take seconds) — it renders NOTHING. Never a zero (a lie about the
 * world), and no longer «العدّاد مو متاح الحين» either: a public status
 * message about our plumbing is noise on a marketing page (audit 2026-10-04,
 * Part 06 Home). The number appears when it is real, or not at all.
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

/** The one number formatter (@moraqat/core) — Western digits, locale grouping. */
function formatCount(n: number, isAr: boolean) {
  return formatNumber(n, isAr ? "ar" : "en");
}

interface CensusCounterProps {
  isAr: boolean;
  t: {
    counterLabel: string;
    counterLabelOne: string;
    /** Kept in the dictionary for compatibility; no longer rendered. */
    counterLoading?: string;
    counterUnavailable?: string;
  };
  /** "hero" is the inline chip beside the CTA; "strip" is the big standalone number. */
  variant?: "hero" | "strip";
  className?: string;
}

export function CensusCounter({ isAr, t, variant = "hero", className }: CensusCounterProps) {
  const { data, isLoading, isError } = useCensus();
  const reduced = useReducedMotion();

  // Loading, cold start or error: nothing at all (see the note above).
  if (isLoading || isError || !data) return null;

  const count = data.registered;
  // Arabic counted noun: 3–10 (by the last two digits) take the plural «قطط»;
  // everything else keeps the singular «قطة» (11+ tamyeez, and 1/2 read fine
  // after a numeral). English keeps its one/other pair.
  const tail = count % 100;
  const label = isAr
    ? tail >= 3 && tail <= 10
      ? "قطط مسجّلة في مرقط"
      : t.counterLabel
    : count === 1
      ? t.counterLabelOne
      : t.counterLabel;
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
          <span className="tabular">
            {isAr ? `— الرقم التسلسلي ${data.latestPublicCatNumber}` : `— serial #${data.latestPublicCatNumber}`}
          </span>
        </p>
      )}
      {/* The count and the serial are different facts. Say so once, plainly,
          wherever both appear — a reader who sees "70" then "#86" deserves the
          reason, not a contradiction (R006). */}
      {data.latestPublicCatNumber !== null && data.latestPublicCatNumber > data.registered && (
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
          {isAr
            ? "الأرقام التسلسلية لا تُعاد أبداً — القط الذي يُحذف أو سجل العيادة الذي لم يُستلم بعد يحتفظ برقمه، لذلك قد يتجاوز آخر رقم عدد القطط المسجّلة الآن."
            : "Serials are never reused — a removed cat or an unclaimed clinic record keeps its number, so the latest serial can run ahead of today's count."}
        </p>
      )}
    </div>
  );
}
