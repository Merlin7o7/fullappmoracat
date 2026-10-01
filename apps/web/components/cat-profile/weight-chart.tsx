"use client";

import * as React from "react";
import { formatDate, formatWeight } from "@moraqat/core";

export interface WeightPoint {
  weightKg: number;
  measuredAt: string;
  source?: string;
}

/**
 * A cat's weight over time — one series, so no legend: the section title names
 * it. 2px emerald line, 8px markers, a recessive grid, a hover/focus tooltip
 * on every point, and a visually-hidden table so the numbers are never
 * picture-only (dataviz: thin marks, one axis, table view, hover by default).
 */
export function WeightChart({ points, isAr }: { points: WeightPoint[]; isAr: boolean }) {
  const loc = isAr ? "ar" : "en";
  const data = React.useMemo(
    () =>
      [...points]
        .filter((p) => Number.isFinite(p.weightKg))
        .sort((a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt)),
    [points]
  );
  const [hover, setHover] = React.useState<number | null>(null);

  // A viewBox close to a phone's width keeps 12-unit labels legible when scaled.
  const W = 400;
  const H = 160;
  // The value axis sits on the reading-start side (right in Arabic).
  const pad = isAr ? { top: 14, right: 34, bottom: 24, left: 12 } : { top: 14, right: 12, bottom: 24, left: 34 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const ws = data.map((d) => d.weightKg);
  const lo = Math.max(0, Math.floor((Math.min(...ws) - 0.3) * 2) / 2);
  const hi = Math.ceil((Math.max(...ws) + 0.3) * 2) / 2;
  const t0 = data.length ? +new Date(data[0]!.measuredAt) : 0;
  const t1 = data.length ? +new Date(data[data.length - 1]!.measuredAt) : 1;
  const span = Math.max(1, t1 - t0);

  // RTL reads right-to-left: time runs from the start edge, so the newest
  // point sits at the reading end in both languages.
  const xOf = (t: number) => {
    const f = data.length === 1 ? 0.5 : (t - t0) / span;
    return pad.left + (isAr ? 1 - f : f) * innerW;
  };
  const yOf = (w: number) => pad.top + (1 - (w - lo) / Math.max(0.5, hi - lo)) * innerH;
  const pts = data.map((d) => ({ x: xOf(+new Date(d.measuredAt)), y: yOf(d.weightKg), d }));
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const ticks = [lo, (lo + hi) / 2, hi];

  const first = data[0];
  const last = data[data.length - 1];
  const summary =
    first && last
      ? isAr
        ? `الوزن من ${formatWeight(first.weightKg, "ar")} إلى ${formatWeight(last.weightKg, "ar")} خلال ${data.length} قياسات`
        : `Weight from ${formatWeight(first.weightKg, "en")} to ${formatWeight(last.weightKg, "en")} across ${data.length} measurements`
      : "";

  if (data.length === 0) return null;

  const active = hover != null ? pts[hover] : null;

  return (
    <figure className="relative max-w-xl">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={summary}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={yOf(t)} y2={yOf(t)} className="stroke-border" strokeWidth={1} />
            <text
              x={isAr ? W - pad.right + 6 : pad.left - 6}
              y={yOf(t) + 4}
              textAnchor={isAr ? "start" : "end"}
              className="fill-muted-foreground text-[12px]"
            >
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        {pts.length > 1 && (
          <path d={path} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {active && <line x1={active.x} x2={active.x} y1={pad.top} y2={H - pad.bottom} className="stroke-foreground/25" strokeWidth={1} />}
        {pts.map((p, i) => (
          <g key={i}>
            {/* Hit target larger than the mark. */}
            <circle
              cx={p.x}
              cy={p.y}
              r={14}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${formatDate(p.d.measuredAt, loc, "short")}: ${formatWeight(p.d.weightKg, loc)}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="cursor-default outline-none"
            />
            <circle cx={p.x} cy={p.y} r={4} className="fill-primary stroke-card" strokeWidth={2} pointerEvents="none" />
          </g>
        ))}
        {first && last && data.length > 1 && (
          <>
            <text x={xOf(t0)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[12px]">
              {formatDate(first.measuredAt, loc, "monthYear")}
            </text>
            <text x={xOf(t1)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[12px]">
              {formatDate(last.measuredAt, loc, "monthYear")}
            </text>
          </>
        )}
      </svg>
      {active && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-e2"
          style={{ left: `${(active.x / W) * 100}%` }}
        >
          <p className="font-medium text-foreground">{formatWeight(active.d.weightKg, loc)}</p>
          <p className="text-muted-foreground">{formatDate(active.d.measuredAt, loc, "short")}</p>
        </div>
      )}
      <table className="sr-only">
        <caption>{isAr ? "سجل الوزن" : "Weight log"}</caption>
        <thead>
          <tr>
            <th>{isAr ? "التاريخ" : "Date"}</th>
            <th>{isAr ? "الوزن" : "Weight"}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <td>{formatDate(d.measuredAt, loc, "short")}</td>
              <td>{formatWeight(d.weightKg, loc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
