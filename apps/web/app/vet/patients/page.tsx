"use client";

/**
 * The clinic's own patients.
 *
 * Linked from the rail, the thumb bar and `g p`, and previously a 404 — the
 * endpoint did not exist either. Deliberately scoped to cats this clinic has
 * actually treated: a clinic's patient list is its treatment history, never the
 * member base. Browsing other people's cats is not a feature we withheld, it is
 * a leak we refuse.
 */

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Cat, ScanLine, Search } from "lucide-react";
import { Badge, Button, Card, Input, Skeleton } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { formatDate } from "@/lib/datetime";
import { useVetActor, useVetApi } from "@/lib/vet-api";
import { QueryError } from "@/components/query-error";
import { EmptyState, PatientRow } from "@/components/vet/vet-shell-bits";

export default function VetPatientsPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const actor = useVetActor();
  const api = useVetApi();

  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const patients = useQuery({
    queryKey: ["vet-own-patients", actor.orgId, debounced],
    queryFn: () => api.listPatients({ q: debounced || undefined }),
    enabled: actor.ready && !!actor.orgId,
  });

  const items = patients.data?.items ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-3 sm:p-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">
              {isAr ? "المرضى" : "Patients"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isAr ? "القطط اللي عالجتوها في عيادتكم" : "Cats your clinic has treated"}
            </p>
          </div>
          <Link href="/vet/scan">
            <Button size="sm" variant="secondary">
              <ScanLine className="size-4" aria-hidden />
              {isAr ? "مسح هوية" : "Scan an ID"}
            </Button>
          </Link>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute inset-inline-start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="ps-9"
            placeholder={isAr ? "الاسم أو رقم الهوية أو الشريحة" : "Name, Cat ID or microchip"}
            aria-label={isAr ? "ابحث في مرضى العيادة" : "Search your clinic's patients"}
          />
        </div>
      </header>

      {patients.isLoading && (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {patients.isError && (
        <QueryError
          isAr={isAr}
          onRetry={() => void patients.refetch()}
          retrying={patients.isFetching}
        />
      )}

      {patients.isSuccess && items.length === 0 && (
        <EmptyState
          icon={Cat}
          title={
            debounced
              ? isAr
                ? "ما لقينا أي قط بهذا البحث"
                : "No patient matches that search"
              : isAr
                ? "ما عندكم مرضى بعد"
                : "No patients yet"
          }
          body={
            debounced
              ? isAr
                ? "جرّبوا رقم الهوية أو رقم الشريحة."
                : "Try the Cat ID or the microchip number."
              : isAr
                ? "أول قط تفتحون له زيارة يظهر هنا، ويبقى في ذاكرة العيادة."
                : "The first cat you open a visit for appears here, and stays in your clinic's memory."
          }
          action={
            !debounced ? (
              <Link href="/vet/scan">
                <Button size="sm">
                  <ScanLine className="size-4" aria-hidden />
                  {isAr ? "ابدأ بمسح" : "Start with a scan"}
                </Button>
              </Link>
            ) : undefined
          }
        />
      )}

      {items.length > 0 && (
        <Card className="p-2 sm:p-3">
          <ul className="flex flex-col gap-0.5">
            {items.map((p) => (
              <li key={p.catId}>
                <PatientRow
                  name={p.name}
                  catIdNumber={p.catIdNumber ?? ""}
                  photoUrl={p.photoUrl}
                  href={`/vet/patients/${encodeURIComponent(p.catId)}`}
                  meta={
                    <>
                      {p.ownerName && <span className="truncate">{p.ownerName}</span>}
                      {p.lastVisitAt && (
                        <span className="truncate">
                          {isAr ? "آخر زيارة " : "Last visit "}
                          {formatDate(p.lastVisitAt, isAr ? "ar" : "en")}
                        </span>
                      )}
                    </>
                  }
                  trailing={
                    p.hasOpenVisit ? (
                      <Badge variant="info" dot>
                        {isAr ? "زيارة مفتوحة" : "Open visit"}
                      </Badge>
                    ) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
