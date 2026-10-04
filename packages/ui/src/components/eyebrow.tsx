import * as React from "react";
import { cn } from "../lib/cn";

/**
 * The small label above a heading — branched by script (R103, audit Part 05/08).
 *
 *   Latin  → mono, uppercase, tracked: the "official layer" voice.
 *   Arabic → text-xs, font-medium, NO tracking, no mono: Arabic is a joined
 *            script and letter-spacing tears it (the ceremony's «نطبع هوية…»
 *            was the visible proof).
 *
 * Pass `locale` when you know it (the reliable path). Without it the branch
 * follows the document direction via the `rtl:` variant.
 */
export type EyebrowLocale = "ar" | "en";

const LATIN = "font-mono text-xs uppercase tracking-[0.22em]";
const ARABIC = "font-sans text-xs font-medium normal-case tracking-normal";
const AUTO = `${LATIN} rtl:font-sans rtl:font-medium rtl:normal-case rtl:tracking-normal`;

/** Class string for an eyebrow — for motion components that can't take <Eyebrow>. */
export function eyebrowClass(locale?: EyebrowLocale, className?: string): string {
  return cn(locale === "ar" ? ARABIC : locale === "en" ? LATIN : AUTO, className);
}

export interface EyebrowProps extends React.HTMLAttributes<HTMLParagraphElement> {
  locale?: EyebrowLocale;
  as?: "p" | "span" | "div";
}

export function Eyebrow({ locale, as = "p", className, ...props }: EyebrowProps) {
  const Comp = as;
  return <Comp className={eyebrowClass(locale, className)} {...props} />;
}
