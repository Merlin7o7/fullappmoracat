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
   * The number formatter (R103/R110: one formatter, Western digits). Pass the
   * app's `formatNumber` from @moraqat/core, e.g. `(n) => formatNumber(n, "ar")`.
   * The default groups with commas and fixes `decimals` — never
   * `toLocaleString`, which gave admin Arabic-Indic digits (audit Part 05).
   */
  format?: (n: number) => string;
}

function defaultFormat(n: number, decimals: number): string {
  const [int, frac] = n.toFixed(decimals).split(".");
  const grouped = (int ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${grouped}.${frac}` : grouped;
}

/** Counts up to `value` on mount/change. Respects prefers-reduced-motion. */
export function AnimatedCounter({ value, durationMs = 900, decimals = 0, prefix = "", suffix = "", className, format }: AnimatedCounterProps) {
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

  const formatted = format ? format(Number(display.toFixed(decimals))) : defaultFormat(display, decimals);
  return <span className={className}>{prefix}{formatted}{suffix}</span>;
}
