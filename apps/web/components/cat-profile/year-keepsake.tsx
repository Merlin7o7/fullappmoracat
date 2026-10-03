"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Card, EmptyState, IdBand, Ledger, LedgerRow, Seal, Skeleton } from "@moraqat/ui";
import { formatAge, formatDate, formatNumber, formatWeight } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import type { PortalCat } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { Illo3D } from "@/components/illo-3d";
import { PrintButton } from "@/components/print-button";
import { QueryError } from "@/components/query-error";

type Bi = { ar: string; en: string };
interface YearData {
  year: number;
  cat: { name: string; photoUrl: string | null; catIdNumber: string | null };
  ageMonthsAtEnd: number | null;
  weight: { start: number; end: number; count: number } | null;
  counts: { vaccines: number; visits: number; moments: number };
  photos: string[];
  milestones: { key: string; kind: string; at: string; title: Bi; sub?: Bi | null }[];
}

/**
 * «عام {cat}» — the yearly keepsake (W10). An editorial annual, not a
 * dashboard: one year of the cat's life told in a few true lines, the photos
 * the owner kept, and the milestones in order. Printable; everything on it
 * comes from the record and the owner's own moments — nothing is inferred.
 */
export function YearKeepsake({ cat, year, isAr }: { cat: PortalCat; year: number; isAr: boolean }) {
  const { authedFetch, user } = useAuth();
  const loc = isAr ? "ar" : "en";
  const name = localizeName(cat.name, loc);
  const q = useQuery({
    queryKey: ["cat-year", cat.id, year],
    queryFn: () => authedFetch<YearData>(`/cats/${cat.id}/year/${year}`),
    enabled: !!user,
  });

  if (q.isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (q.isError || !q.data) return <QueryError isAr={isAr} onRetry={() => q.refetch()} retrying={q.isFetching} />;
  const d = q.data;
  const milestones = [...d.milestones].sort((a, b) => +new Date(a.at) - +new Date(b.at));
  const quiet = milestones.length === 0 && d.photos.length === 0;

  // The year in sentences — only facts we hold, each line only when true.
  const lines: string[] = [];
  const age = formatAge(d.ageMonthsAtEnd, loc);
  const ongoing = year === new Date().getFullYear();
  if (age) {
    lines.push(
      ongoing
        ? isAr ? `عمر ${name} الآن ${age}، والعام لم ينتهِ بعد.` : `${name} is ${age} now, and the year isn't over yet.`
        : isAr ? `أنهى ${name} العام وعمره ${age}.` : `${name} ended the year aged ${age}.`
    );
  }
  if (d.weight && d.weight.count > 1) {
    const diff = Math.round((d.weight.end - d.weight.start) * 10) / 10;
    lines.push(
      diff === 0
        ? isAr ? `حافظ على وزنه عند ${formatWeight(d.weight.end, loc)}.` : `Held steady at ${formatWeight(d.weight.end, loc)}.`
        : isAr ? `انتقل وزنه من ${formatWeight(d.weight.start, loc)} إلى ${formatWeight(d.weight.end, loc)}.` : `Went from ${formatWeight(d.weight.start, loc)} to ${formatWeight(d.weight.end, loc)}.`
    );
  }
  if (d.counts.moments > 0) {
    lines.push(isAr ? `حفظتَ له ${formatNumber(d.counts.moments, loc)} ${d.counts.moments === 1 ? "لحظة" : d.counts.moments === 2 ? "لحظتين" : "لحظات"}.` : `You kept ${d.counts.moments} moment${d.counts.moments === 1 ? "" : "s"}.`);
  }

  return (
    <article className="mx-auto max-w-3xl space-y-8 print:space-y-6" aria-labelledby="keepsake-title">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/portal/cats/${cat.id}/timeline`} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {isAr ? "الألبوم" : "The album"}
        </Link>
        <PrintButton label={isAr ? "اطبع أو احفظ PDF" : "Print or save as PDF"} />
      </div>

      <Card className="overflow-hidden p-0">
        <IdBand
          kind={isAr ? "الكتاب السنوي" : "The yearbook"}
          serial={d.cat.catIdNumber}
          seal={<Seal className="animate-stamp" label={isAr ? "من سجل مرقط" : "From the Moracat register"} />}
        />
        <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-end sm:p-8">
          <div>
            <p className="text-sm text-muted-foreground">{isAr ? "عام" : "The year of"}</p>
            <h1 id="keepsake-title" className="font-display text-4xl sm:text-5xl">
              {name} <span dir="ltr" className="text-muted-foreground">{year}</span>
            </h1>
            {lines.length > 0 && (
              <div className="mt-4 space-y-1 text-lg leading-relaxed">
                {lines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
            )}
          </div>
          {d.cat.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.cat.photoUrl} alt={name} className="aspect-square w-40 rounded-2xl object-cover sm:w-48" />
          ) : (
            <Illo3D name="book" px={160} className="relative size-40" />
          )}
        </div>
      </Card>

      {quiet ? (
        <Card>
          <EmptyState
            title={isAr ? "عام هادئ في الألبوم" : "A quiet year in the album"}
            body={isAr ? "أضف لحظات وصوراً من هذا العام وتظهر هنا." : "Add moments and photos from this year and they'll appear here."}
          />
        </Card>
      ) : (
        <>
          <Card className="p-6">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">{isAr ? "العام في سطور" : "The year at a glance"}</h2>
            <Ledger>
              <LedgerRow label={isAr ? "تطعيمات" : "Vaccines"} value={formatNumber(d.counts.vaccines, loc)} />
              <LedgerRow label={isAr ? "زيارات طبيب" : "Vet visits"} value={formatNumber(d.counts.visits, loc)} />
              <LedgerRow label={isAr ? "لحظات محفوظة" : "Moments kept"} value={formatNumber(d.counts.moments, loc)} />
              {d.weight && <LedgerRow label={isAr ? "آخر وزن في العام" : "Last weight of the year"} value={formatWeight(d.weight.end, loc)} />}
            </Ledger>
          </Card>

          {d.photos.length > 0 && (
            <section aria-labelledby="ks-photos" className="space-y-3">
              <h2 id="ks-photos" className="font-display text-3xl">{isAr ? "صور العام" : "Photos of the year"}</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {d.photos.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p} src={p} alt={isAr ? `صورة ${i + 1} من عام ${name}` : `Photo ${i + 1} of ${name}'s year`} loading="lazy" className="aspect-square w-full rounded-md object-cover" />
                ))}
              </div>
            </section>
          )}

          {milestones.length > 0 && (
            <section aria-labelledby="ks-ms" className="space-y-3">
              <h2 id="ks-ms" className="font-display text-3xl">{isAr ? "ما حدث" : "What happened"}</h2>
              <Card className="p-6">
                <ol className="space-y-4">
                  {milestones.map((m) => (
                    <li key={m.key} className="grid grid-cols-[7rem_1fr] gap-3 border-b border-border/70 pb-4 last:border-b-0 last:pb-0">
                      <span className="text-sm text-muted-foreground">{formatDate(m.at, loc, "medium")}</span>
                      <span>
                        <span className="font-medium">{isAr ? m.title.ar : m.title.en}</span>
                        {m.sub ? <span className="block text-sm text-muted-foreground">{isAr ? m.sub.ar : m.sub.en}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </Card>
            </section>
          )}
        </>
      )}

      <p className="text-center text-sm text-muted-foreground">{isAr ? "مرقط — لِحياة قطّك كلّها" : "Moracat — for your cat's whole life"}</p>
    </article>
  );
}
