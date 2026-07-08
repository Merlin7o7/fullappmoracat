"use client";

import * as React from "react";

interface AnimatedCounterProps {
  value: number;
  durationMs?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /**
   * BCP-47 locale for number formatting (R110). Pass "ar" for Arabic-Indic
   * digits on member-facing value (e.g. the savings tally). Defaults to
   * "en-US" — deterministic Latin numerals, which also avoids an SSR/CSR
   * hydration mismatch when the caller doesn't know the locale at render.
   */
  locale?: string;
}

/** Counts up to `value` on mount/change. Respects prefers-reduced-motion. */
export function AnimatedCounter({ value, durationMs = 900, decimals = 0, prefix = "", suffix = "", className, locale = "en-US" }: AnimatedCounterProps) {
  const [display, setDisplay] = React.useState(0);
  const fromRef = React.useRef(0);

  React.useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setDisplay(value); fromRef.current = value; return; }

    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutExpo for a premium settle.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  const formatted = display.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <span className={className}>{prefix}{formatted}{suffix}</span>;
}
