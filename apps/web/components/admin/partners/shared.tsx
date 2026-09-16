"use client";

/**
 * Shared primitives for the Partners console (MRC-VET-002).
 *
 * The console is a reviewer's instrument: dense, calm, and honest about time.
 * Everything here exists so every card speaks the same visual language —
 * one section frame, one key/value row, one way of saying "this expires soon".
 */

import * as React from "react";
import { AlertTriangle, type LucideIcon } from "lucide-react";
import { Badge, Card, cn } from "@moraqat/ui";
import type { ClinicOrgStatus, RegistrationGap } from "@moraqat/core";
import { registrationError } from "@/lib/vet-registration";
import { fmtDate } from "@/app/admin/_components/i18n";

export type BadgeVariant = "default" | "secondary" | "accent" | "success" | "warning" | "info" | "destructive" | "outline";

/** Status → badge colour. Colour is never the only signal: the label is always rendered (R093). */
export function clinicStatusVariant(status: ClinicOrgStatus): BadgeVariant {
  switch (status) {
    case "INVITED":
      return "info";
    case "REGISTERING":
      return "secondary";
    case "SUBMITTED":
    case "IN_REVIEW":
      return "warning";
    case "CHANGES_REQUESTED":
      return "accent";
    case "APPROVED":
      return "default";
    case "LIVE":
      return "success";
    case "SUSPENDED":
    case "REJECTED":
      return "destructive";
    default:
      return "secondary";
  }
}

const DAY_MS = 86_400_000;

/** Whole days from now until `iso` (negative = in the past). */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((t - Date.now()) / DAY_MS);
}

/** Whole days since `iso`. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
}

export function fmtNumber(n: number, isAr: boolean) {
  return n.toLocaleString(isAr ? "ar-SA" : "en-US");
}

/** Expiry tone: past → red, ≤60 days → amber, otherwise neutral. */
export function expiryTone(iso: string | null | undefined): "expired" | "soon" | "ok" | "none" {
  const d = daysUntil(iso);
  if (d === null) return "none";
  if (d < 0) return "expired";
  if (d <= 60) return "soon";
  return "ok";
}

/** A date that turns amber/red as it approaches/passes — licences and CRs lapse quietly otherwise. */
export function ExpiryText({ iso, isAr, className }: { iso: string | null | undefined; isAr: boolean; className?: string }) {
  if (!iso) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const tone = expiryTone(iso);
  const d = daysUntil(iso) ?? 0;
  const date = fmtDate(iso, isAr);
  if (tone === "expired") {
    return (
      <span className={cn("inline-flex items-center gap-1 font-medium text-destructive", className)}>
        <AlertTriangle aria-hidden className="size-3.5" />
        {isAr ? `منتهٍ منذ ${date}` : `Expired ${date}`}
      </span>
    );
  }
  if (tone === "soon") {
    return (
      <span className={cn("inline-flex items-center gap-1 font-medium text-[hsl(38_92%_32%)] dark:text-warning", className)}>
        <AlertTriangle aria-hidden className="size-3.5" />
        {isAr ? `${date} (بعد ${fmtNumber(d, true)} يوم)` : `${date} (in ${d}d)`}
      </span>
    );
  }
  return <span className={className}>{date}</span>;
}

export function SectionCard({
  icon: Icon,
  title,
  count,
  action,
  children,
  className,
  id,
}: {
  icon: LucideIcon;
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = React.useId();
  return (
    <Card className={cn("p-5", className)} id={id}>
      <section aria-labelledby={headingId}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon aria-hidden className="size-4 text-muted-foreground" />
            <h2 id={headingId} className="font-display font-semibold">
              {title}
            </h2>
            {typeof count === "number" && <span className="text-sm tabular-nums text-muted-foreground">({count})</span>}
          </div>
          {action}
        </div>
        {children}
      </section>
    </Card>
  );
}

/** One key/value line inside a <dl>. `ltr` for emails, phones, registry numbers (R101). */
export function KV({
  label,
  children,
  ltr,
  mono,
}: {
  label: string;
  children?: React.ReactNode;
  ltr?: boolean;
  mono?: boolean;
}) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-border py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm font-medium", mono && "font-mono text-xs")} dir={ltr ? "ltr" : undefined}>
        {empty ? <span className="text-muted-foreground">—</span> : children}
      </dd>
    </div>
  );
}

export function YesNo({ value, isAr }: { value: boolean; isAr: boolean }) {
  return value ? (
    <Badge variant="success">{isAr ? "نعم" : "Yes"}</Badge>
  ) : (
    <Badge variant="secondary">{isAr ? "لا" : "No"}</Badge>
  );
}

/**
 * Turn any mutation error into a toast payload: what happened + what to do
 * next (R084, R112). When the API returns gaps, they are listed, not hidden.
 */
export function describeError(err: unknown, isAr: boolean): { title: string; description: string; gaps?: RegistrationGap[] } {
  const f = registrationError(err, isAr);
  // Toast descriptions render as a single paragraph, so gaps are joined inline;
  // the review workspace also renders them as a proper list.
  const gapText = f.gaps?.length ? ` ${f.gaps.map((g) => (isAr ? g.ar : g.en)).join(" · ")}` : "";
  return { title: f.title, description: `${f.message}${gapText}`, gaps: f.gaps };
}

export function GapList({ gaps, isAr, className }: { gaps: RegistrationGap[]; isAr: boolean; className?: string }) {
  if (gaps.length === 0) return null;
  return (
    <ul className={cn("list-disc space-y-1 ps-5 text-sm", className)}>
      {gaps.map((g, i) => (
        <li key={`${g.code}-${g.branchId ?? ""}-${i}`}>{isAr ? g.ar : g.en}</li>
      ))}
    </ul>
  );
}

/** Tailwind classes shared by native <select>/<textarea> so they match the kit's Input. */
export const fieldClass =
  "w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground shadow-e1 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export const DAY_NAMES: { ar: string; en: string }[] = [
  { ar: "الأحد", en: "Sun" },
  { ar: "الاثنين", en: "Mon" },
  { ar: "الثلاثاء", en: "Tue" },
  { ar: "الأربعاء", en: "Wed" },
  { ar: "الخميس", en: "Thu" },
  { ar: "الجمعة", en: "Fri" },
  { ar: "السبت", en: "Sat" },
];
