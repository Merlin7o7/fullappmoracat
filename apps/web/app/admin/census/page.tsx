"use client";

/**
 * The Census — Phase 0's operating instrument (MRC-GTM-001 §1–§2).
 *
 * Nothing is for sale for ~6 weeks, so /admin reads all-zeros and cannot answer
 * the only question that matters right now: *which stand is actually producing
 * cats*. The strategy commits to "kill or move any stand under 20 IDs/month"
 * (§2), so per-source yield — not revenue — is the operational heart of this
 * page and everything else is context around it.
 *
 * Honesty rules this page even though only staff see it (R006 — no fake
 * scarcity): the founding cohort is shown as *issued of limit*, never as a
 * "places left" countdown, because the same two numbers appear on the public
 * site and staff must read the same truth members do. The 20/month threshold is
 * annotated with a word as well as a tint (R093 — no colour-only meaning), and
 * a source with nothing in it yet says so plainly rather than showing a
 * placeholder. Arabic-first, RTL-native (R101); numerals run dir="ltr" so
 * digits don't reorder inside a mirrored table.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Cat, MapPin, Sparkles, Loader2 } from "lucide-react";
import { Card, Badge, Skeleton, AnimatedCounter } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { QueryError } from "@/components/query-error";
import { IlloCat } from "@/components/illustrations";
import { fmtDate, fmtNum } from "@/app/admin/_components/i18n";

/** The documented kill-or-move line for a physical stand (MRC-GTM-001 §2). */
const YIELD_THRESHOLD_30D = 20;

interface CensusSource {
  source: string;
  total: number;
  last30Days: number;
}

interface CensusResp {
  registered: number;
  registeredLast30Days: number;
  foundingLimit: number;
  foundingIssued: number;
  sources: CensusSource[];
  recent: {
    catNumber: number;
    name: string;
    catIdNumber: string | null;
    sourceCode: string | null;
    createdAt: string;
  }[];
}

export default function AdminCensusPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const numLocale = isAr ? "ar" : "en-US";

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-census", user?.id],
    queryFn: () => authedFetch<CensusResp>("/admin/census"),
    enabled: !!user?.isStaff,
  });

  // Sorted by total desc so the strongest channel reads first; the server
  // already orders this way, but the page must not depend on that to be scannable.
  const sources = React.useMemo(
    () => [...(data?.sources ?? [])].sort((a, b) => b.total - a.total),
    [data?.sources],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "التعداد" : "Census"}</h1>
        <p className="text-sm text-muted-foreground">
          {isAr
            ? "المرحلة صفر — الهويات المسجّلة ومن أين جاءت."
            : "Phase 0 — Cat IDs registered, and where they came from."}
        </p>
      </div>

      {isError ? (
        <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
      ) : (
        <>
          {/* 1 — The headline count. The single number Phase 0 is judged on. */}
          <Card className="relative overflow-hidden p-6 sm:p-8">
            <IlloCat tone="green" className="pointer-events-none absolute -bottom-3 end-6 size-24 opacity-20" />
            <span className="mb-4 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Cat className="size-5" />
            </span>
            {isLoading || !data ? (
              <Skeleton className="h-12 w-40" />
            ) : (
              <p className="font-display text-5xl font-bold tabular" dir="ltr">
                <AnimatedCounter value={data.registered} locale={numLocale} />
              </p>
            )}
            <p className="mt-1 text-sm font-medium">{isAr ? "هوية قط مسجّلة" : "Cat IDs registered"}</p>
            {data && (
              <p className="mt-1 text-xs text-muted-foreground">
                {isAr
                  ? `${fmtNum(data.registeredLast30Days, true)} خلال آخر ٣٠ يوماً`
                  : `${fmtNum(data.registeredLast30Days, false)} in the last 30 days`}
              </p>
            )}
          </Card>

          {/* 2 — Founding cohort progress. Two real numbers, stated plainly.
              Deliberately NOT "N places left": a countdown manufactures urgency
              (R006) and would drift from the public site's wording. */}
          <Card className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" />
              <h2 className="font-display font-semibold">{isAr ? "الدفعة التأسيسية" : "Founding cohort"}</h2>
            </div>
            {isLoading || !data ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <>
                <p className="font-display text-2xl font-bold tabular" dir="ltr">
                  {fmtNum(data.foundingIssued, isAr)}
                  <span className="text-muted-foreground"> / {fmtNum(data.foundingLimit, isAr)}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isAr ? "هوية تأسيسية صدرت من إجمالي الدفعة." : "Founding Cat IDs issued of the cohort total."}
                </p>
                {/* Progress, not pressure — a plain proportion with its numbers
                    already spelled out above it for screen readers. */}
                <div
                  className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={data.foundingLimit}
                  aria-valuenow={data.foundingIssued}
                  aria-label={isAr ? "الهويات التأسيسية الصادرة" : "Founding Cat IDs issued"}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${pct(data.foundingIssued, data.foundingLimit)}%` }}
                  />
                </div>
              </>
            )}
          </Card>

          {/* 3 — Per-source yield: the operational heart. Every row is a stand
              (or "direct") and the last-30-days column is the one that decides
              whether it stays where it is. */}
          <Card className="p-6">
            <div className="mb-1 flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" />
              <h2 className="font-display font-semibold">{isAr ? "الحصيلة حسب المصدر" : "Yield by source"}</h2>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              {isAr
                ? `العتبة الموثّقة: ${fmtNum(YIELD_THRESHOLD_30D, true)} هوية شهرياً لكل موقع.`
                : `Documented threshold: ${YIELD_THRESHOLD_30D} IDs per month per location.`}
            </p>

            {isLoading || !data ? (
              <Skeleton className="h-32 w-full" />
            ) : sources.length === 0 ? (
              // R111 — an empty census is a beginning, not a void.
              <EmptyNote
                text={isAr
                  ? "لم يُسجَّل أي قط بعد. أول هوية ستظهر هنا لحظة صدورها."
                  : "No cats registered yet. The first Cat ID will appear here the moment it's issued."}
              />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="p-3 text-start">{isAr ? "المصدر" : "Source"}</th>
                      <th className="p-3 text-start">{isAr ? "الإجمالي" : "Total"}</th>
                      <th className="p-3 text-start">{isAr ? "آخر ٣٠ يوماً" : "Last 30 days"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sources.map((s) => {
                      const below = s.last30Days < YIELD_THRESHOLD_30D;
                      // "direct" isn't a stand, so the threshold verdict doesn't
                      // apply to it — flagging it would invent a decision.
                      const isDirect = s.source === "direct";
                      return (
                        <tr key={s.source} className="hover:bg-muted/30">
                          <td className="p-3 font-medium">
                            {isDirect ? (
                              <span className="text-muted-foreground">{isAr ? "مباشر (بدون رمز)" : "Direct (no code)"}</span>
                            ) : (
                              <span dir="ltr" className="inline-block">{s.source}</span>
                            )}
                          </td>
                          <td className="p-3 tabular" dir="ltr">{fmtNum(s.total, isAr)}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="tabular" dir="ltr">{fmtNum(s.last30Days, isAr)}</span>
                              {/* Factual marker, not an alarm — the word carries
                                  the meaning, the tint only echoes it (R093). */}
                              {below && !isDirect && (
                                <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                                  {isAr
                                    ? `دون ${fmtNum(YIELD_THRESHOLD_30D, true)}/شهر`
                                    : `under ${YIELD_THRESHOLD_30D}/mo`}
                                </Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* 4 — Recent registrations. Named cats, in order of arrival: the
              census is people and animals, not just a counter (principle 9). */}
          <Card className="p-6">
            <h2 className="mb-4 font-display font-semibold">{isAr ? "أحدث التسجيلات" : "Recent registrations"}</h2>
            {isLoading || !data ? (
              <Skeleton className="h-32 w-full" />
            ) : data.recent.length === 0 ? (
              <EmptyNote
                text={isAr
                  ? "لا تسجيلات بعد — أول قط في الطريق."
                  : "No registrations yet — the first cat is on its way."}
              />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="p-3 text-start">#</th>
                      <th className="p-3 text-start">{isAr ? "القط" : "Cat"}</th>
                      <th className="p-3 text-start">{isAr ? "رقم الهوية" : "Cat ID"}</th>
                      <th className="p-3 text-start">{isAr ? "المصدر" : "Source"}</th>
                      <th className="p-3 text-start">{isAr ? "التاريخ" : "Date"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.recent.map((c) => (
                      <tr key={c.catNumber} className="hover:bg-muted/30">
                        <td className="p-3 tabular text-muted-foreground" dir="ltr">{fmtNum(c.catNumber, isAr)}</td>
                        <td className="p-3 font-medium">{c.name}</td>
                        {/* The Cat ID number is an identifier, never localised
                            into Arabic-Indic digits — it must match the card. */}
                        <td className="p-3 tabular" dir="ltr">
                          {c.catIdNumber ?? <span className="text-muted-foreground">{isAr ? "لم تصدر بعد" : "not issued yet"}</span>}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {c.sourceCode
                            ? <span dir="ltr" className="inline-block">{c.sourceCode}</span>
                            : (isAr ? "مباشر" : "Direct")}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {fmtDate(c.createdAt, isAr, { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {isFetching && !isLoading && (
            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {isAr ? "يُحدَّث…" : "Refreshing…"}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Warm nothing-yet note (R111) — a welcome, never a blank cell or a zero-stub. */
function EmptyNote({ text }: { text: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border py-10 text-center">
      <IlloCat tone="cream" className="size-10 opacity-80" />
      <p className="mt-3 max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/** Clamped percentage — a limit overrun must never render a bar past 100%. */
const pct = (n: number, of: number) => (of <= 0 ? 0 : Math.min(100, (n / of) * 100));
