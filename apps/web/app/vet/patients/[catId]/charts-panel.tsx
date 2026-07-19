"use client";

// ════════════════════════════════════════════════════════════════════════
//  ChartsPanel — weight over time (MRC-VET-001 §06, §10).
//
//  "Weight shows trend, not just number." A single 4.1 kg tells a vet almost
//  nothing; 4.4 → 4.1 over ten weeks tells them where to look. This panel
//  makes the SHAPE of the data legible, and stops there.
//
//  Four disciplines:
//   • Honest, never diagnostic. It says "down 6.8% over 90 days" and says
//     outright that a trend is a measurement, not a diagnosis. It will never
//     say "losing weight — investigate" (R006, and it isn't our call).
//   • Provenance is visible. Each point is CLINIC-measured or OWNER-reported,
//     and they are drawn differently, because a vet weighing a cat on a
//     calibrated scale and an owner's bathroom-scale estimate are not the
//     same evidence. Averaging them silently would be a quiet lie.
//   • Accessible by construction. The SVG is decorative (aria-hidden) and the
//     truth lives in a real <table> with real headers that any user can open
//     — screen-reader users get the same data in the same place (R095).
//   • RTL-native: in Arabic, time runs right-to-left, so the axis mirrors. A
//     chart that reads backwards is a mistranslation (R101, R104).
//
//  No new dependencies — hand-drawn SVG, which is also why it costs nothing
//  on a clinic tablet.
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, Minus, Table2, TrendingDown, TrendingUp } from "lucide-react";
import { Badge, Button, Card, Skeleton, cn } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { formatDate } from "@/lib/datetime";
import { QueryError } from "@/components/query-error";
import { IlloSprig } from "@/components/illustrations";
import { useVetActor, useVetApi, type WeightPoint } from "@/lib/vet-api";

const W = 720;
const H = 240;
const PAD = { top: 16, right: 20, bottom: 30, left: 46 };
const DAY = 86_400_000;

export default function ChartsPanel({ catId, className }: { catId: string; className?: string }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const actor = useVetActor();
  const api = useVetApi();
  const canRead = actor.can("record.read");
  const [asTable, setAsTable] = React.useState(false);

  const query = useQuery({
    queryKey: ["vet-weights", catId],
    queryFn: () => api.getPatientWeights(catId),
    enabled: canRead,
  });

  if (!canRead) {
    return (
      <Card className={cn("p-6", className)}>
        <p className="text-sm text-muted-foreground">
          {isAr
            ? "منحنى الوزن جزء من السجل السريري، وهو خارج نطاق دورك."
            : "The weight chart is part of the clinical record, which isn't part of your role."}
        </p>
      </Card>
    );
  }

  if (query.isLoading) {
    return (
      <Card className={cn("p-5", className)} aria-hidden>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-56 rounded-xl" />
      </Card>
    );
  }
  if (query.isError) {
    return (
      <QueryError
        isAr={isAr}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        className={className}
      />
    );
  }

  // Oldest → newest, so the line reads as time.
  const points = [...(query.data?.series ?? [])].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  const latest = points[points.length - 1];
  const first = points[0];

  if (!first || !latest) {
    return (
      <Card className={cn("flex flex-col items-center gap-3 p-10 text-center", className)}>
        <IlloSprig tone="leaf" className="size-10 opacity-70" aria-hidden />
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "لا قياسات وزن بعد. أول قياس يبدأ المنحنى — والثاني يجعله ذا معنى."
            : "No weight measurements yet. The first one starts the line — the second gives it meaning."}
        </p>
      </Card>
    );
  }

  const ownerReported = points.filter((p) => p.source === "OWNER").length;

  // The honest sentence. Direction words only; no clinical inference.
  const pct = first.kg ? ((latest.kg - first.kg) / first.kg) * 100 : 0;
  const days = Math.max(
    1,
    Math.round((new Date(latest.at).getTime() - new Date(first.at).getTime()) / DAY)
  );
  const dir: "UP" | "DOWN" | "STABLE" = pct > 0.5 ? "UP" : pct < -0.5 ? "DOWN" : "STABLE";
  const abs = Math.abs(pct).toFixed(1);

  const trendSentence =
    points.length < 2
      ? isAr
        ? "قياس واحد فقط — المنحنى يحتاج قياسين على الأقل ليعني شيئاً."
        : "One measurement only — a trend needs at least two to mean anything."
      : dir === "STABLE"
        ? isAr
          ? `مستقر خلال ${days} يوماً (تغيّر ${abs}٪).`
          : `Stable across ${days} days (${abs}% change).`
        : isAr
          ? `${dir === "UP" ? "ارتفاع" : "انخفاض"} ${abs}٪ خلال ${days} يوماً.`
          : `${dir === "UP" ? "Up" : "Down"} ${abs}% across ${days} days.`;

  const TrendIcon = dir === "UP" ? TrendingUp : dir === "DOWN" ? TrendingDown : Minus;

  // The full description a screen reader hears in place of the drawing.
  const chartLabel = isAr
    ? `منحنى الوزن: ${points.length} قياس من ${formatDate(first.at, locale)} إلى ${formatDate(latest.at, locale)}. آخر وزن ${latest.kg} كجم. ${trendSentence}`
    : `Weight chart: ${points.length} measurements from ${formatDate(first.at, locale)} to ${formatDate(latest.at, locale)}. Latest weight ${latest.kg} kg. ${trendSentence}`;

  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold tracking-tight">
            {isAr ? "الوزن عبر الزمن" : "Weight over time"}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {latest.kg}
            </span>
            <span className="text-muted-foreground">{isAr ? "كجم" : "kg"}</span>
            <span className="text-xs text-muted-foreground">· {formatDate(latest.at, locale)}</span>
            <span className="text-xs text-muted-foreground">
              ·{" "}
              {latest.source === "CLINIC"
                ? isAr
                  ? "قياس عيادة"
                  : "clinic-measured"
                : isAr
                  ? "من المالك"
                  : "owner-reported"}
            </span>
          </p>
        </div>
        <Badge variant={dir === "STABLE" ? "secondary" : "info"}>
          <TrendIcon className="size-3" aria-hidden />
          {trendSentence}
        </Badge>
      </div>

      <div className="mt-4">
        {asTable ? (
          <MeasurementTable points={points} />
        ) : (
          <figure>
            <div
              role="img"
              aria-label={chartLabel}
              className="overflow-hidden rounded-xl border border-border bg-background"
            >
              <WeightChart points={points} rtl={isAr} />
            </div>
            <figcaption className="sr-only">{chartLabel}</figcaption>
          </figure>
        )}
      </div>

      {/* Provenance legend — colour is never the only carrier (R093). */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-2 border-[hsl(var(--primary))] bg-[hsl(var(--card))]" aria-hidden />
          {isAr ? "قياس عيادة (دائرة مصمتة الحد)" : "Clinic-measured (solid ring)"}
        </li>
        {ownerReported > 0 && (
          <li className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full border-2 border-dashed border-[hsl(var(--muted-foreground))]"
              aria-hidden
            />
            {isAr
              ? `من المالك (${ownerReported}) — تقدير، لا قياس`
              : `Owner-reported (${ownerReported}) — an estimate, not a measurement`}
          </li>
        )}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setAsTable((v) => !v)}>
          <Table2 className="size-4" />
          {asTable ? (isAr ? "اعرض المنحنى" : "Show the chart") : isAr ? "اعرض الجدول" : "Show the table"}
        </Button>
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          {isAr
            ? "هذا سجل قياسات، لا تشخيص. التفسير السريري يبقى لك."
            : "This is a record of measurements, not a diagnosis. The clinical interpretation stays yours."}
        </p>
      </div>
    </Card>
  );
}

// ── the drawing ──────────────────────────────────────────────────────────

function WeightChart({ points, rtl }: { points: WeightPoint[]; rtl: boolean }) {
  const { locale } = useLocale();
  const oldest = points[0];
  const newest = points[points.length - 1];
  if (!oldest || !newest) return null;

  const times = points.map((p) => new Date(p.at).getTime());
  const weights = points.map((p) => p.kg);

  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  // Pad the y-domain so the line never touches the frame, and never let a
  // flat series collapse to a zero-height band.
  const wMinRaw = Math.min(...weights);
  const wMaxRaw = Math.max(...weights);
  const span = Math.max(wMaxRaw - wMinRaw, 0.4);
  const wMin = wMinRaw - span * 0.2;
  const wMax = wMaxRaw + span * 0.2;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (t: number) => {
    const frac = tMax === tMin ? 0.5 : (t - tMin) / (tMax - tMin);
    // In Arabic, time runs right-to-left.
    return PAD.left + (rtl ? 1 - frac : frac) * innerW;
  };
  const y = (w: number) => PAD.top + (1 - (w - wMin) / (wMax - wMin)) * innerH;

  const ordered = rtl ? [...points].reverse() : points;
  const path = ordered
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${x(new Date(p.at).getTime()).toFixed(1)},${y(p.kg).toFixed(1)}`
    )
    .join(" ");
  // In RTL the drawing order is reversed, so the edges swap with it.
  const lastX = x(new Date((rtl ? oldest : newest).at).getTime()).toFixed(1);
  const firstX = x(new Date((rtl ? newest : oldest).at).getTime()).toFixed(1);
  const area = `${path} L${lastX},${(H - PAD.bottom).toFixed(1)} L${firstX},${(H - PAD.bottom).toFixed(1)} Z`;

  // Four horizontal gridlines — enough to read a value, few enough to stay calm.
  const ticks = [0, 1, 2, 3].map((i) => wMin + ((wMax - wMin) * i) / 3);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-56 w-full"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id="wt-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(t)}
            y2={y(t)}
            stroke="hsl(var(--border))"
            strokeWidth="1"
            strokeDasharray={i === 0 ? undefined : "3 4"}
          />
          <text
            x={rtl ? W - PAD.right + 6 : PAD.left - 8}
            y={y(t) + 4}
            textAnchor={rtl ? "start" : "end"}
            className="fill-[hsl(var(--muted-foreground))] font-mono"
            style={{ fontSize: 11 }}
          >
            {t.toFixed(1)}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#wt-fill)" />
      <path
        d={path}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {points.map((p, i) => (
        <circle
          key={i}
          cx={x(new Date(p.at).getTime())}
          cy={y(p.kg)}
          r={i === points.length - 1 ? 5 : 3.5}
          fill="hsl(var(--card))"
          stroke={p.source === "OWNER" ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))"}
          strokeWidth="2"
          strokeDasharray={p.source === "OWNER" ? "2 2" : undefined}
        />
      ))}

      {/* First and last date only — a dense axis in a 720px box is noise. */}
      <text
        x={x(tMin)}
        y={H - 8}
        textAnchor="middle"
        className="fill-[hsl(var(--muted-foreground))]"
        style={{ fontSize: 11 }}
      >
        {formatDate(oldest.at, locale, { day: "numeric", month: "short" })}
      </text>
      {points.length > 1 && (
        <text
          x={x(tMax)}
          y={H - 8}
          textAnchor="middle"
          className="fill-[hsl(var(--muted-foreground))]"
          style={{ fontSize: 11 }}
        >
          {formatDate(newest.at, locale, { day: "numeric", month: "short" })}
        </text>
      )}
    </svg>
  );
}

function MeasurementTable({ points }: { points: WeightPoint[] }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const rows = [...points].reverse();

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">
          {isAr ? "قياسات الوزن ومصدر كل قياس" : "Weight measurements and the source of each"}
        </caption>
        <thead className="bg-muted/60">
          <tr>
            <th scope="col" className="px-3 py-2 text-start text-xs font-semibold text-muted-foreground">
              {isAr ? "التاريخ" : "Date"}
            </th>
            <th scope="col" className="px-3 py-2 text-start text-xs font-semibold text-muted-foreground">
              {isAr ? "الوزن (كجم)" : "Weight (kg)"}
            </th>
            <th scope="col" className="px-3 py-2 text-start text-xs font-semibold text-muted-foreground">
              {isAr ? "التغيّر" : "Change"}
            </th>
            <th scope="col" className="px-3 py-2 text-start text-xs font-semibold text-muted-foreground">
              {isAr ? "المصدر" : "Source"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((p, i) => {
            const prev = rows[i + 1];
            const delta = prev ? p.kg - prev.kg : null;
            return (
              <tr key={`${p.at}-${i}`}>
                <th scope="row" className="px-3 py-2 text-start font-normal text-foreground">
                  {formatDate(p.at, locale)}
                </th>
                <td className="px-3 py-2 font-mono tabular-nums text-foreground">{p.kg}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">
                  {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {p.source === "CLINIC"
                    ? isAr
                      ? "عيادة"
                      : "Clinic"
                    : isAr
                      ? "المالك"
                      : "Owner"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
