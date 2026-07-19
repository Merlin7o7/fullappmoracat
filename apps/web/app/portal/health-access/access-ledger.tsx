"use client";

/**
 * The access ledger — the proof behind the promise.
 *
 * Consent screens everywhere say "we protect your data". This list is the
 * reason an owner can believe it here: every time a clinic opens the record,
 * a row appears with the clinic's name, the person, what they opened and when.
 * Nothing is summarised away, and an emergency read is marked louder than a
 * routine one rather than blended in (R006 honest, R106 PDPL).
 *
 * It is deliberately read-only: the ledger records history, so there is nothing
 * to act on here. Acting happens above, on the grants.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { Card, Skeleton } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { Pagination } from "@/app/admin/_components/pagination";
import { QueryError } from "@/components/query-error";
import { IlloPaw } from "@/components/illustrations";
import {
  type AccessLogResponse,
  EmergencyBadge,
  TierBadge,
  orgName,
} from "@/components/vet-consent-card";

/** What the clinic was looking at, in an owner's words rather than a route name. */
function surfaceLabel(surface: string, isAr: boolean): string {
  const MAP: Record<string, { ar: string; en: string }> = {
    PROFILE: { ar: "الملف الطبي", en: "the medical profile" },
    OVERVIEW: { ar: "نظرة عامة على القط", en: "the overview" },
    HEALTH: { ar: "السجل الصحي", en: "the health record" },
    VACCINATIONS: { ar: "سجل التطعيمات", en: "the vaccination record" },
    VISITS: { ar: "سجل الزيارات", en: "the visit history" },
    FILES: { ar: "الملفات والتقارير", en: "files and reports" },
    LABS: { ar: "نتائج التحاليل", en: "lab results" },
    IMAGING: { ar: "الأشعة والصور", en: "imaging" },
    PRESCRIPTIONS: { ar: "الوصفات الطبية", en: "prescriptions" },
    VERIFY: { ar: "التحقق من العضوية", en: "the membership check" },
  };
  const hit = MAP[surface];
  if (hit) return isAr ? hit.ar : hit.en;
  // Unknown surface: show it plainly rather than invent a friendly name.
  return surface.toLowerCase().replace(/_/g, " ");
}

export function AccessLedger({ catId, catName, isAr }: { catId: string; catName?: string; isAr: boolean }) {
  const { authedFetch, user } = useAuth();
  const [page, setPage] = React.useState(1);

  // A different cat is a different ledger — never show page 4 of the last cat.
  React.useEffect(() => {
    setPage(1);
  }, [catId]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["vet-access-log", user?.id, catId, page],
    queryFn: () =>
      authedFetch<AccessLogResponse>(
        `/vet/owner/access-log?catId=${encodeURIComponent(catId)}&page=${page}`
      ),
    enabled: !!user && !!catId,
  });

  const cat = catName || (isAr ? "قطك" : "your cat");

  return (
    <section aria-labelledby="ledger-heading" className="space-y-4">
      <div>
        <h2 id="ledger-heading" className="font-display text-lg font-semibold">
          {isAr ? "سجل الاطلاع" : "Access ledger"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isAr
            ? `كل مرة فتحت فيها عيادة سجل ${cat} — من، ومتى، وماذا رأى.`
            : `Every time a clinic opened ${cat}'s record — who, when, and what they saw.`}
        </p>
      </div>

      {isError ? (
        <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
      ) : isLoading ? (
        <Card className="divide-y divide-border p-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4">
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </Card>
      ) : !data || data.items.length === 0 ? (
        // An empty ledger is good news, and it should read like good news
        // rather than a void (R111).
        <Card className="relative flex flex-col items-center gap-3 overflow-hidden p-10 text-center">
          <IlloPaw tone="sage" aria-hidden className="pointer-events-none absolute start-8 top-6 size-7 -rotate-12 opacity-50" />
          <IlloPaw tone="butter" aria-hidden className="pointer-events-none absolute bottom-6 end-10 size-7 rotate-[18deg] opacity-50" />
          <span aria-hidden className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Eye className="size-5" />
          </span>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? `لم تفتح أي عيادة سجل ${cat} بعد. أول مرة تحدث، ستجدها مكتوبة هنا.`
              : `No clinic has opened ${cat}'s record yet. The first time one does, you'll find it written here.`}
          </p>
        </Card>
      ) : (
        <>
          <Card className="divide-y divide-border p-0">
            <ul>
              {data.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{orgName(item, isAr)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {item.staffName
                        ? isAr
                          ? `${item.staffName} فتح ${surfaceLabel(item.surface, isAr)}`
                          : `${item.staffName} opened ${surfaceLabel(item.surface, isAr)}`
                        : isAr
                          ? `فُتح ${surfaceLabel(item.surface, isAr)}`
                          : `Opened ${surfaceLabel(item.surface, isAr)}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <time dateTime={item.at}>{formatDateTime(item.at, isAr ? "ar" : "en")}</time>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.emergency && <EmergencyBadge isAr={isAr} />}
                    <TierBadge tier={item.tier} isAr={isAr} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
            isAr={isAr}
          />
        </>
      )}
    </section>
  );
}
