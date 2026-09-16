"use client";

/**
 * The partner pipeline — every clinic from invitation to live, in one dense
 * table. Density is the courtesy here: a reviewer scans dozens of rows.
 *
 * The API returns "waiting on Moracat" first (oldest submission first), and
 * the table says out loud how long each has waited — a registration aging
 * quietly is the failure this console exists to prevent.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Clock, Rocket, ShieldCheck, RotateCw, FlaskConical } from "lucide-react";
import { Badge, Button, Card, Skeleton, cn } from "@moraqat/ui";
import { CLINIC_STATUS_LABELS, type ClinicOrgStatus } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { useRegistrationApi, registrationError, type AdminClinicRow } from "@/lib/vet-registration";
import { Pagination } from "@/app/admin/_components/pagination";
import { fmtDate } from "@/app/admin/_components/i18n";
import { IlloMouse } from "@/components/illustrations";
import { clinicStatusVariant, daysSince, daysUntil, fmtNumber } from "./shared";

/** Pill order follows the lifecycle, left to right (right to left in Arabic). */
const FILTERS: ("" | ClinicOrgStatus)[] = [
  "",
  "SUBMITTED",
  "IN_REVIEW",
  "INVITED",
  "REGISTERING",
  "CHANGES_REQUESTED",
  "APPROVED",
  "LIVE",
  "SUSPENDED",
  "REJECTED",
];

const EMPTY_COPY: Partial<Record<"" | ClinicOrgStatus, { ar: string; en: string }>> = {
  "": { ar: "لا توجد عيادات بعد. ابدأ بدعوة أول عيادة.", en: "No clinics yet. Start by inviting the first one." },
  SUBMITTED: { ar: "لا شيء بانتظار المراجعة — الطابور فاضي.", en: "Nothing awaiting review — the queue is clear." },
  IN_REVIEW: { ar: "لا توجد تسجيلات قيد المراجعة.", en: "No registrations in review." },
  INVITED: { ar: "لا توجد دعوات معلّقة.", en: "No outstanding invitations." },
  REGISTERING: { ar: "لا توجد عيادات تعبّئ التسجيل الآن.", en: "No clinics are filling in their registration right now." },
  CHANGES_REQUESTED: { ar: "لا توجد تسجيلات بانتظار تعديلات.", en: "No registrations waiting on changes." },
  APPROVED: { ar: "لا توجد عيادات في مرحلة التجهيز.", en: "No clinics setting up." },
  LIVE: { ar: "لا توجد عيادات فعّالة بعد.", en: "No live clinics yet." },
  SUSPENDED: { ar: "لا توجد عيادات موقوفة.", en: "No suspended clinics." },
  REJECTED: { ar: "لا توجد تسجيلات مرفوضة.", en: "No rejected registrations." },
};

export function ClinicPipeline({ isAr }: { isAr: boolean }) {
  const { user } = useAuth();
  const api = useRegistrationApi();
  const router = useRouter();
  // null = not chosen yet; resolved to SUBMITTED (if anything waits) or All
  // once the first counts arrive, so the reviewer lands on the work.
  const [status, setStatus] = React.useState<"" | ClinicOrgStatus | null>(null);
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(1);
  }, [q, status]);

  const query = useQuery({
    queryKey: ["admin-clinics", user?.id, status ?? "", q, page],
    queryFn: () => api.adminList({ status: status || undefined, q: q || undefined, page }),
    enabled: !!user?.isStaff,
    placeholderData: (prev) => prev,
  });
  const { data, isLoading, isError, error, refetch, isFetching, isPlaceholderData } = query;

  React.useEffect(() => {
    if (status === null && data) {
      setStatus((data.statusCounts.SUBMITTED ?? 0) > 0 ? "SUBMITTED" : "");
    }
  }, [status, data]);

  const counts = data?.statusCounts ?? {};
  const total = Object.values(counts).reduce<number>((a, b) => a + (b ?? 0), 0);
  // Hold the skeleton until the default filter resolves — unless the load failed.
  const resolving = status === null && !isError;
  const open = (id: string) => router.push(`/admin/partners/${id}`);
  const COLS = 7;
  const activeKey = status ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div role="group" aria-label={isAr ? "تصفية بالحالة" : "Filter by status"} className="flex flex-wrap gap-1.5">
          {FILTERS.map((key) => {
            const label = key === "" ? { ar: "الكل", en: "All" } : CLINIC_STATUS_LABELS[key];
            const n = key === "" ? total : counts[key] ?? 0;
            const active = activeKey === key && status !== null;
            return (
              <button
                key={key || "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(key)}
                className={cn(
                  "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {isAr ? label.ar : label.en}
                <span
                  className={cn(
                    "rounded-full px-1.5 tabular-nums",
                    active ? "bg-background/20" : n > 0 && (key === "SUBMITTED" || key === "IN_REVIEW") ? "bg-warning/20 text-foreground" : "bg-muted"
                  )}
                >
                  {data ? fmtNumber(n, isAr) : "·"}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative shrink-0">
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={isAr ? "بحث في العيادات" : "Search clinics"}
            placeholder={isAr ? "الاسم، البريد، السجل التجاري…" : "Name, email, CR number…"}
            className="h-11 w-full rounded-full border border-input bg-background pe-4 ps-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-72"
          />
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-busy={isFetching || undefined}>
            <caption className="sr-only">{isAr ? "العيادات البيطرية الشريكة" : "Partner veterinary clinics"}</caption>
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-medium">{isAr ? "العيادة" : "Clinic"}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{isAr ? "المدينة" : "City"}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{isAr ? "جهة الاتصال" : "Contact"}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{isAr ? "الحالة" : "Status"}</th>
                <th scope="col" className="px-4 py-3 text-center font-medium">{isAr ? "الفروع" : "Branches"}</th>
                <th scope="col" className="px-4 py-3 text-center font-medium">{isAr ? "الفريق" : "Staff"}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{isAr ? "أُرسل / الانتظار" : "Submitted / waiting"}</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y divide-border transition-opacity", isPlaceholderData && "opacity-60")}>
              {isLoading || resolving ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={COLS} className="px-4 py-3">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={COLS} className="px-4 py-14 text-center">
                    <p className="font-medium">{registrationError(error, isAr).title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{registrationError(error, isAr).message}</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => void refetch()}>
                      <RotateCw aria-hidden />
                      {isAr ? "إعادة المحاولة" : "Try again"}
                    </Button>
                  </td>
                </tr>
              ) : data && data.items.length > 0 ? (
                data.items.map((row) => <PipelineRow key={row.id} row={row} isAr={isAr} onOpen={open} />)
              ) : (
                <tr>
                  <td colSpan={COLS} className="px-4 py-14 text-center text-muted-foreground">
                    <IlloMouse tone="sage" aria-hidden className="mx-auto mb-3 h-8 w-auto opacity-80" />
                    {q
                      ? isAr
                        ? `لا توجد نتائج لـ «${q}».`
                        : `No clinics match “${q}”.`
                      : isAr
                        ? EMPTY_COPY[activeKey]?.ar
                        : EMPTY_COPY[activeKey]?.en}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {data && !resolving && (
        <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} isAr={isAr} />
      )}
    </div>
  );
}

function PipelineRow({ row, isAr, onOpen }: { row: AdminClinicRow; isAr: boolean; onOpen: (id: string) => void }) {
  const name = (isAr ? row.nameAr : row.nameEn) || row.nameEn || row.nameAr || "—";
  const city = row.city ? (isAr ? row.city.nameAr : row.city.nameEn) : null;
  const inReview = row.status === "SUBMITTED" || row.status === "IN_REVIEW";
  const waited = inReview ? daysSince(row.submittedAt) : null;
  const stale = row.status === "SUBMITTED" && waited !== null && waited >= 7;
  const readyToGoLive = !!row.goLiveRequestedAt || (row.status === "APPROVED" && !!row.testScanAt);

  return (
    <tr
      onClick={() => onOpen(row.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(row.id);
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={isAr ? `فتح ${name}` : `Open ${name}`}
      className="cursor-pointer outline-none hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <td className="px-4 py-3">
        <p className="flex flex-wrap items-center gap-1.5 font-medium">
          {name}
          {row.verified && <ShieldCheck aria-label={isAr ? "موثّقة" : "Verified"} className="size-3.5 text-success" />}
          {row.isDemo && (
            <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
              <FlaskConical aria-hidden className="size-3" />
              {isAr ? "تجريبية" : "Demo"}
            </Badge>
          )}
          {row.tier === "founding" && (
            <Badge variant="accent" className="px-1.5 py-0 text-[10px]">
              {isAr ? "مؤسس" : "Founding"}
            </Badge>
          )}
        </p>
        {row.contactEmail && (
          <p className="text-xs text-muted-foreground" dir="ltr">
            <span className="inline-block text-start">{row.contactEmail}</span>
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{city || "—"}</td>
      <td className="px-4 py-3">
        <p>{row.contactName || "—"}</p>
        {row.contactPhone && (
          <p className="text-xs text-muted-foreground" dir="ltr">
            <span className="inline-block">{row.contactPhone}</span>
          </p>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge variant={clinicStatusVariant(row.status)}>{isAr ? row.statusLabel.ar : row.statusLabel.en}</Badge>
        {row.status === "INVITED" && <InviteState invite={row.invite} isAr={isAr} />}
        {readyToGoLive && row.status !== "LIVE" && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success">
            <Rocket aria-hidden className="size-3.5" />
            {isAr ? "جاهزة للتفعيل" : "Ready to go live"}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-center tabular-nums">{fmtNumber(row.branchCount, isAr)}</td>
      <td className="px-4 py-3 text-center tabular-nums">{fmtNumber(row.staffCount, isAr)}</td>
      <td className="px-4 py-3">
        {inReview && waited !== null ? (
          <span className={cn("inline-flex items-center gap-1.5 tabular-nums", stale && "font-medium text-destructive")}>
            <Clock aria-hidden className="size-3.5" />
            {waited === 0
              ? isAr
                ? "اليوم"
                : "Today"
              : isAr
                ? `منذ ${fmtNumber(waited, true)} يوم`
                : `${waited}d waiting`}
          </span>
        ) : row.submittedAt ? (
          <span className="text-muted-foreground">{fmtDate(row.submittedAt, isAr)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

function InviteState({ invite, isAr }: { invite: AdminClinicRow["invite"]; isAr: boolean }) {
  if (!invite) {
    return <p className="mt-1 text-xs text-muted-foreground">{isAr ? "لا توجد دعوة" : "No invitation"}</p>;
  }
  if (invite.revoked) {
    return <p className="mt-1 text-xs text-muted-foreground">{isAr ? "سُحبت الدعوة" : "Invitation withdrawn"}</p>;
  }
  if (invite.claimed) {
    return <p className="mt-1 text-xs text-muted-foreground">{isAr ? "استُخدمت الدعوة" : "Invitation claimed"}</p>;
  }
  const d = daysUntil(invite.expiresAt);
  if (invite.expired || (d !== null && d < 0)) {
    return <p className="mt-1 text-xs font-medium text-destructive">{isAr ? "انتهت الدعوة — أعد الإرسال" : "Invite expired — resend"}</p>;
  }
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {d === 0
        ? isAr
          ? "تنتهي اليوم"
          : "Expires today"
        : isAr
          ? `تنتهي بعد ${fmtNumber(d ?? 0, true)} يوم`
          : `Expires in ${d} day${d === 1 ? "" : "s"}`}
    </p>
  );
}
