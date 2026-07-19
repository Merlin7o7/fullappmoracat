"use client";

/**
 * The day-book — every visit at this clinic, open ones first.
 *
 * This route was linked from the desktop rail, the mobile thumb bar, the More
 * drawer and the `g v` shortcut, and did not exist: staff tapping "Visits" got
 * a 404. It is the screen a clinic lives in all day, so it leads with what is
 * waiting rather than with chrome.
 */

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ScanLine } from "lucide-react";
import { Badge, Button, Card, Skeleton } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { formatDateTime, type UiLocale } from "@/lib/datetime";
import { useVetActor, useVetApi, vetVisitStateLabel, type VetVisit } from "@/lib/vet-api";
import { QueryError } from "@/components/query-error";
import { EmptyState, PatientRow } from "@/components/vet/vet-shell-bits";

export default function VetVisitsPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const actor = useVetActor();
  const api = useVetApi();

  const visits = useQuery({
    queryKey: ["vet-visits", actor.orgId],
    queryFn: () => api.listVisits(),
    enabled: actor.ready && !!actor.orgId,
  });

  const items = visits.data?.items ?? [];
  const open = items.filter((v) => v.state === "OPEN");
  const closed = items.filter((v) => v.state === "CLOSED");

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-3 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">
            {isAr ? "الزيارات" : "Visits"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? `${open.length} زيارة مفتوحة الآن`
              : `${open.length} open right now`}
          </p>
        </div>
        <Link href="/vet/scan">
          <Button size="sm">
            <ScanLine className="size-4" aria-hidden />
            {isAr ? "ابدأ بمسح" : "Start with a scan"}
          </Button>
        </Link>
      </header>

      {visits.isLoading && (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {visits.isError && (
        <QueryError isAr={isAr} onRetry={() => void visits.refetch()} retrying={visits.isFetching} />
      )}

      {visits.isSuccess && items.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title={isAr ? "ما فيه زيارات اليوم" : "No visits yet today"}
          body={
            isAr
              ? "أول ما تمسح هوية قط أو تفتح زيارة، تظهر هنا."
              : "The moment you scan a Cat ID or open a visit, it appears here."
          }
        />
      )}

      {open.length > 0 && (
        <VisitGroup
          title={isAr ? "مفتوحة الآن" : "Open now"}
          visits={open}
          isAr={isAr}
          locale={locale}
        />
      )}
      {closed.length > 0 && (
        <VisitGroup
          title={isAr ? "مُغلقة" : "Closed"}
          visits={closed}
          isAr={isAr}
          locale={locale}
        />
      )}
    </div>
  );
}

function VisitGroup({
  title,
  visits,
  isAr,
  locale,
}: {
  title: string;
  visits: VetVisit[];
  isAr: boolean;
  locale: UiLocale;
}) {
  return (
    <Card className="p-2 sm:p-3">
      <h2 className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <ul className="flex flex-col gap-0.5">
        {visits.map((v) => (
          <li key={v.id}>
            <PatientRow
              name={v.cat.name}
              catIdNumber={v.cat.catIdNumber ?? ""}
              photoUrl={v.cat.photoUrl}
              href={`/vet/visits/${encodeURIComponent(v.id)}`}
              meta={
                <>
                  <span className="truncate">
                    {formatDateTime(v.checkedInAt, locale, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {v.reason && <span className="truncate">{v.reason}</span>}
                </>
              }
              trailing={
                <span className="flex flex-col items-end gap-0.5">
                  <Badge variant={v.state === "OPEN" ? "info" : "secondary"} dot>
                    {vetVisitStateLabel(v.state, isAr)}
                  </Badge>
                  {v.state === "OPEN" && v.waitMinutes !== null && (
                    <span className="text-[0.625rem] text-muted-foreground tabular">
                      {isAr ? `${v.waitMinutes} د` : `${v.waitMinutes} min`}
                    </span>
                  )}
                </span>
              }
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
