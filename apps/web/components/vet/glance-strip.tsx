"use client";

import { Scale, Syringe, CalendarDays, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatDate, formatRelative, formatWeight } from "@moraqat/core";
import type { VetPatientProfile } from "@/lib/vet-api";

/**
 * The 30-second read (W7). Under the identity and the safety band, three
 * facts a clinician checks before anything else — weight and its direction,
 * the next vaccine due, the last visit — each in one cell, no tabs to open.
 * Plain on purpose: the clinical surface is fast and precise, not decorated.
 * Withheld data says "withheld", never a blank (R040).
 */
export function GlanceStrip({ profile, isAr }: { profile: VetPatientProfile; isAr: boolean }) {
  const loc = isAr ? "ar" : "en";
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const weights = profile.weights ? [...profile.weights].sort((a, b) => +new Date(a.at) - +new Date(b.at)) : null;
  const last = weights?.[weights.length - 1];
  const prev = weights && weights.length > 1 ? weights[weights.length - 2] : undefined;
  const delta = last && prev ? Math.round((last.kg - prev.kg) * 10) / 10 : null;
  const Trend = delta == null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  const now = Date.now();
  const nextDue = profile.vaccinations
    ? [...profile.vaccinations].filter((v) => v.dueAt).sort((a, b) => +new Date(a.dueAt!) - +new Date(b.dueAt!))[0]
    : undefined;
  const overdue = nextDue?.dueAt ? +new Date(nextDue.dueAt) < now : false;

  // A tiny trend line — the shape, not the numbers (those are in Charts).
  const spark = (() => {
    if (!weights || weights.length < 2) return null;
    const pts = weights.slice(-8);
    const lo = Math.min(...pts.map((p) => p.kg));
    const hi = Math.max(...pts.map((p) => p.kg));
    const W = 64;
    const H = 20;
    const d = pts
      .map((p, i) => {
        const x = (i / (pts.length - 1)) * W;
        const y = H - ((p.kg - lo) / Math.max(0.1, hi - lo)) * (H - 2) - 1;
        return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-5 w-16 rtl:-scale-x-100" aria-hidden>
        <path d={d} fill="none" className="stroke-primary" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  })();

  const cell = "flex min-w-0 items-start gap-3 rounded-md border border-border bg-card p-3";

  return (
    <section aria-label={t("لمحة سريعة", "At a glance")} className="grid gap-2 sm:grid-cols-3">
      <div className={cell}>
        <Scale className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{t("الوزن", "Weight")}</p>
          {weights === null ? (
            <p className="text-sm text-muted-foreground">{t("محجوب بإذن المالك", "Withheld by the owner")}</p>
          ) : last ? (
            <>
              <p className="flex items-center gap-2 font-medium">
                {formatWeight(last.kg, loc)}
                {spark}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Trend className="size-3.5" aria-hidden />
                {delta != null && delta !== 0
                  ? `${delta > 0 ? "+" : "−"}${formatWeight(Math.abs(delta), loc)} · `
                  : ""}
                {formatDate(last.at, loc, "short")}
                {last.source === "OWNER" ? t(" · من المالك", " · owner-entered") : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("لا قياسات", "No weigh-ins")}</p>
          )}
        </div>
      </div>

      <div className={overdue ? `${cell} border-destructive/40 bg-destructive/[0.05]` : cell}>
        <Syringe className={overdue ? "mt-0.5 size-4 shrink-0 text-destructive" : "mt-0.5 size-4 shrink-0 text-muted-foreground"} aria-hidden />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{t("التطعيم القادم", "Next vaccine")}</p>
          {profile.vaccinations === null ? (
            <p className="text-sm text-muted-foreground">{t("محجوب بإذن المالك", "Withheld by the owner")}</p>
          ) : nextDue?.dueAt ? (
            <>
              <p className="truncate font-medium">{isAr ? nextDue.nameAr : nextDue.nameEn}</p>
              <p className={overdue ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
                {overdue ? t("متأخر — ", "Overdue — ") : ""}
                {formatDate(nextDue.dueAt, loc, "short")} · {formatRelative(nextDue.dueAt, loc)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("لا موعد مسجّل", "Nothing scheduled")}</p>
          )}
        </div>
      </div>

      <div className={cell}>
        <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{t("آخر زيارة عندكم", "Last visit here")}</p>
          {profile.lastVisitAt ? (
            <>
              <p className="font-medium">{formatDate(profile.lastVisitAt, loc, "short")}</p>
              <p className="text-xs text-muted-foreground">
                {formatRelative(profile.lastVisitAt, loc)}
                {profile.visitCountHere > 0 ? t(` · ${profile.visitCountHere} زيارات`, ` · ${profile.visitCountHere} visits`) : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("أول زيارة لعيادتكم", "First visit to your clinic")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
