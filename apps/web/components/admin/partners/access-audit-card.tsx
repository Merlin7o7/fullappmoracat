"use client";

/**
 * The record-access audit — Moracat's side of the owner's ledger: the same
 * reads, seen from our side. Emergency reads are marked, because a clinic
 * that breaks glass often is a clinic worth a conversation.
 *
 * GET /vet/admin/orgs/:id/access-logs (not part of lib/vet-registration, so
 * it is typed here against apps/api/src/vet/vet-admin.service.ts#orgAccessLogs).
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Siren, RotateCw } from "lucide-react";
import { Badge, Button, Skeleton, cn } from "@moraqat/ui";
import { VET_ROLE_LABELS, type VetRole } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { registrationError } from "@/lib/vet-registration";
import { Pagination } from "@/app/admin/_components/pagination";
import { fmtDateTime } from "@/app/admin/_components/i18n";
import { tierLabel } from "@/components/vet-consent-card";
import { SectionCard, fmtNumber } from "./shared";

interface AccessLogRow {
  id: string;
  catId: string;
  tier: string;
  surface: string | null;
  emergency: boolean;
  ipAddress: string | null;
  at: string;
  cat: { id: string; name: string; catIdNumber: string | null } | null;
  staff: { id: string; role: VetRole; name: string | null } | null;
}

interface AccessLogPage {
  items: AccessLogRow[];
  pagination: { page: number; limit?: number; total: number; totalPages: number };
}

export function AccessAuditCard({ orgId, isAr }: { orgId: string; isAr: boolean }) {
  const { authedFetch, user } = useAuth();
  const [page, setPage] = React.useState(1);

  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ["admin-clinic-access-logs", user?.id, orgId, page],
    queryFn: () => authedFetch<AccessLogPage>(`/vet/admin/orgs/${encodeURIComponent(orgId)}/access-logs?page=${page}`),
    enabled: !!user?.isStaff && !!orgId,
    placeholderData: (prev) => prev,
  });

  return (
    <SectionCard
      icon={Eye}
      title={isAr ? "سجل الاطلاع على السجلات" : "Record access audit"}
      count={data ? data.pagination.total : undefined}
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="py-6 text-center">
          <p className="text-sm font-medium">{registrationError(error, isAr).title}</p>
          <p className="text-sm text-muted-foreground">{isAr ? "تعذّر تحميل سجل الاطلاع." : "Couldn't load the access log."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
            <RotateCw aria-hidden />
            {isAr ? "إعادة المحاولة" : "Try again"}
          </Button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {isAr ? "لم تفتح هذه العيادة أي سجل بعد." : "This clinic hasn't opened any records yet."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className={cn("w-full text-sm transition-opacity", isPlaceholderData && "opacity-60")}>
              <caption className="sr-only">{isAr ? "سجل اطلاع العيادة على سجلات القطط" : "Clinic record access log"}</caption>
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-2 py-2 text-start font-medium">{isAr ? "الموظف" : "Staff"}</th>
                  <th scope="col" className="px-2 py-2 text-start font-medium">{isAr ? "القطة" : "Cat"}</th>
                  <th scope="col" className="px-2 py-2 text-start font-medium">{isAr ? "المستوى" : "Tier"}</th>
                  <th scope="col" className="px-2 py-2 text-start font-medium">{isAr ? "الوقت" : "When"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((r) => {
                  const role = r.staff ? VET_ROLE_LABELS[r.staff.role] : null;
                  return (
                    <tr key={r.id} className={cn(r.emergency && "bg-destructive/5")}>
                      <td className="px-2 py-2.5">
                        <p className="font-medium">{r.staff?.name || "—"}</p>
                        {role && <p className="text-xs text-muted-foreground">{isAr ? role.ar : role.en}</p>}
                      </td>
                      <td className="px-2 py-2.5">
                        <p>{r.cat?.name || "—"}</p>
                        {r.cat?.catIdNumber && (
                          <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                            <span className="inline-block">{r.cat.catIdNumber}</span>
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={r.tier === "T2" ? "warning" : "info"}>{tierLabel(r.tier, isAr)}</Badge>
                          {r.emergency && (
                            <Badge variant="destructive">
                              <Siren aria-hidden className="size-3" />
                              {isAr ? "طارئ" : "Emergency"}
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground">
                        <time dateTime={r.at}>{fmtDateTime(r.at, isAr)}</time>
                        {r.surface && <p className="text-xs">{r.surface}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
            isAr={isAr}
            className="mt-3"
          />
          <p className="sr-only" aria-live="polite">
            {isAr ? `${fmtNumber(data.pagination.total, true)} عملية اطلاع` : `${data.pagination.total} record accesses`}
          </p>
        </>
      )}
    </SectionCard>
  );
}
