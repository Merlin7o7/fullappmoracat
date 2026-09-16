"use client";

/**
 * Opening hours for one branch — seven rows, Sunday first, the Saudi week.
 * One tap copies a day to the whole week, because most clinics keep the same
 * hours six days out of seven (R002).
 */

import * as React from "react";
import { Copy } from "lucide-react";
import { cn } from "@moraqat/ui";

export interface HourRow {
  day: number;
  open: string;
  close: string;
  closed: boolean;
}

export const DAY_NAMES: { ar: string; en: string }[] = [
  { ar: "الأحد", en: "Sunday" },
  { ar: "الإثنين", en: "Monday" },
  { ar: "الثلاثاء", en: "Tuesday" },
  { ar: "الأربعاء", en: "Wednesday" },
  { ar: "الخميس", en: "Thursday" },
  { ar: "الجمعة", en: "Friday" },
  { ar: "السبت", en: "Saturday" },
];

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function defaultHours(): HourRow[] {
  return DAY_NAMES.map((_, day) => ({ day, open: "09:00", close: "21:00", closed: false }));
}

export function hoursFromWire(hours: { day: number; open?: string; close?: string; closed?: boolean }[] | undefined): HourRow[] {
  const base = defaultHours();
  if (!hours?.length) return base;
  return base.map((row) => {
    const h = hours.find((x) => x.day === row.day);
    if (!h) return { ...row, closed: true };
    return { day: row.day, open: h.open ?? row.open, close: h.close ?? row.close, closed: !!h.closed };
  });
}

export function hoursError(rows: HourRow[], isAr: boolean): string | undefined {
  const bad = rows.find((r) => !r.closed && (!TIME_RE.test(r.open) || !TIME_RE.test(r.close) || r.open === r.close));
  if (!bad) return undefined;
  const day = DAY_NAMES[bad.day];
  return isAr
    ? `راجع أوقات يوم ${day?.ar ?? ""} — اختر وقت فتح وإغلاق مختلفين، أو علّمه «مغلق».`
    : `Check ${day?.en ?? "the"} hours — pick different opening and closing times, or mark it closed.`;
}

export function HoursEditor({
  rows,
  onChange,
  isAr,
  error,
}: {
  rows: HourRow[];
  onChange: (rows: HourRow[]) => void;
  isAr: boolean;
  error?: string;
}) {
  const groupId = React.useId();
  const set = (day: number, patch: Partial<HourRow>) =>
    onChange(rows.map((r) => (r.day === day ? { ...r, ...patch } : r)));
  const copyToAll = (from: HourRow) =>
    onChange(rows.map((r) => ({ ...r, open: from.open, close: from.close, closed: from.closed })));

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={error ? `${groupId}-err` : `${groupId}-hint`}
      data-invalid={error ? true : undefined}
    >
      <legend className="text-sm font-medium">{isAr ? "أوقات العمل" : "Opening hours"}</legend>
      <p id={`${groupId}-hint`} className="-mt-1 text-xs text-muted-foreground">
        {isAr
          ? "إذا تجاوز الإغلاق منتصف الليل، اكتب وقت الإغلاق كما هو (مثلاً ٠١:٠٠)."
          : "If you close after midnight, enter the closing time as it is (e.g. 01:00)."}
      </p>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {rows.map((r) => {
          const name = DAY_NAMES[r.day];
          const label = isAr ? name?.ar : name?.en;
          return (
            <li key={r.day} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
              <span className="w-20 shrink-0 text-sm font-medium">{label}</span>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={r.closed}
                  onChange={(e) => set(r.day, { closed: e.target.checked })}
                  className="size-4 accent-[hsl(var(--primary))]"
                />
                {isAr ? "مغلق" : "Closed"}
              </label>
              <div className={cn("flex flex-1 items-center gap-2", r.closed && "opacity-40")} dir="ltr">
                <input
                  type="time"
                  aria-label={isAr ? `وقت الفتح — ${label}` : `Opens — ${label}`}
                  value={r.open}
                  disabled={r.closed}
                  onChange={(e) => set(r.day, { open: e.target.value })}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm tabular focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="text-xs text-muted-foreground" aria-hidden>
                  –
                </span>
                <input
                  type="time"
                  aria-label={isAr ? `وقت الإغلاق — ${label}` : `Closes — ${label}`}
                  value={r.close}
                  disabled={r.closed}
                  onChange={(e) => set(r.day, { close: e.target.value })}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm tabular focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              {r.day === 0 && (
                <button
                  type="button"
                  onClick={() => copyToAll(r)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Copy className="size-3.5" aria-hidden />
                  {isAr ? "طبّق على كل الأيام" : "Apply to every day"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p id={`${groupId}-err`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
