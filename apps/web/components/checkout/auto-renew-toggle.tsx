"use client";

import * as React from "react";
import { RefreshCcw } from "lucide-react";
import { cn } from "@moraqat/ui";
import type { CheckoutProvider } from "./provider-picker";

/**
 * Opt-IN auto-renew (T7). Unticked by default, every time — a renewal is a
 * choice the member makes, never a default they missed (R006/R025). The copy
 * names the two notices (7 days, 1 day) and the one-tap way out before the
 * member decides. Hidden on rails that cannot renew (Tamara) and on Apple Pay
 * (token reuse unconfirmed, D7) — with an honest note instead of a dead toggle.
 */
export function AutoRenewToggle({
  provider,
  checked,
  onChange,
  isAr,
  termLabel,
}: {
  provider: CheckoutProvider;
  checked: boolean;
  onChange: (v: boolean) => void;
  isAr: boolean;
  /** e.g. "3 months" — the term that would renew. */
  termLabel: string;
}) {
  if (provider === "TAMARA") {
    return (
      <p className="text-xs text-muted-foreground">
        {isAr
          ? "الدفع عبر تمارا لا يتجدد تلقائياً — ندعوك قبل نهاية مدتك، والقرار لك."
          : "Tamara payments never renew themselves — we'll invite you before your term ends, and the choice is yours."}
      </p>
    );
  }
  if (provider === "APPLE_PAY") {
    return (
      <p className="text-xs text-muted-foreground">
        {isAr
          ? "Apple Pay لا يدعم التجديد التلقائي حالياً — ندعوك قبل نهاية مدتك."
          : "Apple Pay doesn't support auto-renew yet — we'll invite you before your term ends."}
      </p>
    );
  }
  const id = "auto-renew";
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
        checked ? "border-primary bg-primary/[0.06]" : "border-border hover:bg-muted/50"
      )}
    >
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
          checked ? "bg-primary" : "bg-muted-foreground/30"
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-background shadow transition-transform",
            checked ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5 rtl:-translate-x-0.5"
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <RefreshCcw className="size-3.5 text-primary" aria-hidden />
          {isAr ? "جدّد عضويتي تلقائياً" : "Renew my membership automatically"}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {isAr
            ? `نذكّرك قبل ٧ أيام ويوم واحد، وتقدر توقفه بضغطة. نفس المدة (${termLabel}) على نفس البطاقة.`
            : `We remind you 7 days and 1 day before, and you can stop it in one tap. Same term (${termLabel}) on the same card.`}
        </span>
      </span>
    </label>
  );
}
