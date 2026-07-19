"use client";

/**
 * Partner console — the reviewer's queue.
 *
 * Two jobs on one screen, because they are one person's workflow: work the
 * application backlog, and manage the clinics already live. Density is the
 * courtesy here (a reviewer scans dozens of rows), so this is a table, not a
 * card grid — the opposite of the owner-facing surfaces on purpose.
 *
 * The queue is oldest-first and shows how long each applicant has been waiting,
 * because a partner application aging quietly is the failure mode this console
 * exists to prevent.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, ShieldCheck, Clock, Siren } from "lucide-react";
import { Card, Badge, Skeleton, cn } from "@moraqat/ui";
import { IlloMouse } from "@/components/illustrations";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Pagination } from "@/app/admin/_components/pagination";
import { fmtDate } from "@/app/admin/_components/i18n";
import { partnerStatusMeta } from "@/components/vet-consent-card";

interface ApplicationRow {
  id: string;
  orgNameEn?: string | null;
  orgNameAr?: string | null;
  city?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  branchCount?: number | null;
  status: string;
  submittedAt?: string | null;
  createdAt?: string | null;
}

interface OrgRow {
  id: string;
  nameEn?: string | null;
  nameAr?: string | null;
  city?: string | null;
  status: string;
  verified?: boolean;
  tier?: string | null;
  branchCount?: number | null;
  staffCount?: number | null;
  emergency24h?: boolean;
  createdAt?: string | null;
}

interface Paged<T> {
  items: T[];
  pagination: { total: number; page: number; totalPages: number };
}

/** Whole days a row has been waiting — the queue's real unit of urgency. */
function daysWaiting(since?: string | null): number | null {
  if (!since) return null;
  const ms = Date.now() - new Date(since).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return Math.floor(ms / 86_400_000);
}

type Tab = "applications" | "orgs";

export default function AdminPartners() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [tab, setTab] = React.useState<Tab>("applications");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "الشركاء" : "Partners"}</h1>
        <p className="text-sm text-muted-foreground">
          {isAr ? "طلبات الانضمام والعيادات البيطرية" : "Applications and veterinary clinics"}
        </p>
      </div>

      <div role="tablist" aria-label={isAr ? "أقسام الشركاء" : "Partner sections"} className="flex gap-2">
        {([
          { key: "applications" as Tab, ar: "الطلبات", en: "Applications" },
          { key: "orgs" as Tab, ar: "العيادات", en: "Clinics" },
        ]).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === t.key ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {isAr ? t.ar : t.en}
          </button>
        ))}
      </div>

      {tab === "applications" ? <ApplicationsTable isAr={isAr} /> : <OrgsTable isAr={isAr} />}
    </div>
  );
}

/** Reusable status filter pills — the reviewer's primary triage control. */
function StatusFilter({
  value, onChange, options, isAr,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { key: string; ar: string; en: string }[];
  isAr: boolean;
}) {
  return (
    <div role="group" aria-label={isAr ? "تصفية بالحالة" : "Filter by status"} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "min-h-[36px] rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.key ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          {isAr ? o.ar : o.en}
        </button>
      ))}
    </div>
  );
}

function ApplicationsTable({ isAr }: { isAr: boolean }) {
  const { authedFetch, user } = useAuth();
  const router = useRouter();
  const [status, setStatus] = React.useState("PENDING");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => { setPage(1); }, [status]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-vet-applications", user?.id, status, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page) });
      if (status) qs.set("status", status);
      return authedFetch<Paged<ApplicationRow>>(`/admin/vet/applications?${qs.toString()}`);
    },
    enabled: !!user?.isStaff,
  });

  // Oldest first: the queue is a promise to whoever has waited longest.
  const rows = React.useMemo(() => {
    const items = data?.items ?? [];
    return [...items].sort((a, b) => {
      const at = new Date(a.submittedAt ?? a.createdAt ?? 0).getTime();
      const bt = new Date(b.submittedAt ?? b.createdAt ?? 0).getTime();
      return at - bt;
    });
  }, [data]);

  const open = (id: string) => router.push(`/admin/partners/${id}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusFilter
          value={status}
          onChange={setStatus}
          isAr={isAr}
          options={[
            { key: "PENDING", ar: "بانتظار المراجعة", en: "Pending" },
            { key: "IN_REVIEW", ar: "قيد المراجعة", en: "In review" },
            { key: "APPROVED", ar: "مقبولة", en: "Approved" },
            { key: "REJECTED", ar: "مرفوضة", en: "Rejected" },
            { key: "", ar: "الكل", en: "All" },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          {data
            ? isAr
              ? `${data.pagination.total.toLocaleString("ar-SA")} طلب`
              : `${data.pagination.total} application${data.pagination.total === 1 ? "" : "s"}`
            : "—"}
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{isAr ? "طلبات انضمام العيادات" : "Clinic partner applications"}</caption>
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-medium">{isAr ? "العيادة" : "Clinic"}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{isAr ? "المدينة" : "City"}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{isAr ? "جهة الاتصال" : "Contact"}</th>
                <th scope="col" className="px-4 py-3 text-center font-medium">{isAr ? "الفروع" : "Branches"}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{isAr ? "الحالة" : "Status"}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{isAr ? "منذ" : "Waiting"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-muted-foreground">
                    {isAr ? "تعذّر التحميل. حاول التحديث." : "Couldn't load. Try refreshing."}
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((a) => {
                  const s = partnerStatusMeta(a.status);
                  const submitted = a.submittedAt ?? a.createdAt ?? null;
                  const days = daysWaiting(submitted);
                  const stale = a.status !== "APPROVED" && a.status !== "REJECTED" && days !== null && days >= 7;
                  return (
                    <tr
                      key={a.id}
                      onClick={() => open(a.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") open(a.id); }}
                      tabIndex={0}
                      role="link"
                      className="cursor-pointer outline-none hover:bg-muted/30 focus-visible:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{(isAr ? a.orgNameAr : a.orgNameEn) || a.orgNameEn || a.orgNameAr || "—"}</p>
                        {a.contactEmail && <p className="text-xs text-muted-foreground" dir="ltr">{a.contactEmail}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.city || "—"}</td>
                      <td className="px-4 py-3">
                        <p>{a.contactName || "—"}</p>
                        {a.contactPhone && <p className="text-xs text-muted-foreground" dir="ltr">{a.contactPhone}</p>}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">{a.branchCount ?? "—"}</td>
                      <td className="px-4 py-3"><Badge variant={s.variant}>{isAr ? s.ar : s.en}</Badge></td>
                      <td className="px-4 py-3">
                        {submitted ? (
                          <span className={cn("inline-flex items-center gap-1.5 tabular-nums", stale && "font-medium text-destructive")}>
                            {stale && <Clock aria-hidden className="size-3.5" />}
                            {days === null
                              ? fmtDate(submitted, isAr)
                              : days === 0
                                ? (isAr ? "اليوم" : "today")
                                : isAr
                                  ? `${days.toLocaleString("ar-SA")} يوم`
                                  : `${days}d`}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-muted-foreground">
                    <IlloMouse tone="sage" aria-hidden className="mx-auto mb-3 h-8 w-auto opacity-80" />
                    {status === "PENDING"
                      ? (isAr ? "لا توجد طلبات بانتظار المراجعة — الطابور فاضي." : "No applications waiting — the queue is clear.")
                      : (isAr ? "لا توجد طلبات بهذه الحالة." : "No applications with this status.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {data && <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} isAr={isAr} />}
    </div>
  );
}

function OrgsTable({ isAr }: { isAr: boolean }) {
  const { authedFetch, user } = useAuth();
  const router = useRouter();
  const [status, setStatus] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => { setPage(1); }, [debounced, status]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-vet-orgs", user?.id, status, debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page) });
      if (status) qs.set("status", status);
      if (debounced) qs.set("q", debounced);
      return authedFetch<Paged<OrgRow>>(`/admin/vet/orgs?${qs.toString()}`);
    },
    enabled: !!user?.isStaff,
  });

  const open = (id: string) => router.push(`/admin/partners/${id}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusFilter
          value={status}
          onChange={setStatus}
          isAr={isAr}
          options={[
            { key: "", ar: "الكل", en: "All" },
            { key: "ACTIVE", ar: "نشطة", en: "Active" },
            { key: "UNVERIFIED", ar: "غير موثّقة", en: "Unverified" },
            { key: "SUSPENDED", ar: "موقوفة", en: "Suspended" },
          ]}
        />
        <div className="relative">
          <Search aria-hidden className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={isAr ? "بحث عن عيادة" : "Search clinics"}
            placeholder={isAr ? "اسم العيادة أو المدينة…" : "Clinic name or city…"}
            className="h-10 w-72 rounded-full border border-input bg-background ps-9 pe-4 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{isAr ? "العيادات البيطرية الشريكة" : "Partner veterinary clinics"}</caption>
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-medium">{isAr ? "العيادة" : "Clinic"}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{isAr ? "المدينة" : "City"}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{isAr ? "الحالة" : "Status"}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{isAr ? "التوثيق" : "Verified"}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{isAr ? "الفئة" : "Tier"}</th>
                <th scope="col" className="px-4 py-3 text-center font-medium">{isAr ? "الفروع" : "Branches"}</th>
                <th scope="col" className="px-4 py-3 text-center font-medium">{isAr ? "الفريق" : "Staff"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-muted-foreground">
                    {isAr ? "تعذّر التحميل. حاول التحديث." : "Couldn't load. Try refreshing."}
                  </td>
                </tr>
              ) : data && data.items.length > 0 ? (
                data.items.map((o) => {
                  const s = partnerStatusMeta(o.status);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => open(o.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") open(o.id); }}
                      tabIndex={0}
                      role="link"
                      className="cursor-pointer outline-none hover:bg-muted/30 focus-visible:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-1.5 font-medium">
                          {(isAr ? o.nameAr : o.nameEn) || o.nameEn || o.nameAr || "—"}
                          {o.emergency24h && <Siren aria-hidden className="size-3.5 text-destructive" />}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{o.city || "—"}</td>
                      <td className="px-4 py-3"><Badge variant={s.variant}>{isAr ? s.ar : s.en}</Badge></td>
                      <td className="px-4 py-3">
                        {o.verified ? (
                          <span className="inline-flex items-center gap-1 text-success">
                            <ShieldCheck aria-hidden className="size-4" />
                            {isAr ? "موثّقة" : "Verified"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{isAr ? "لا" : "No"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{o.tier || "—"}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{o.branchCount ?? "—"}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{o.staffCount ?? "—"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-muted-foreground">
                    <IlloMouse tone="sage" aria-hidden className="mx-auto mb-3 h-8 w-auto opacity-80" />
                    {isAr ? "لا توجد عيادات مطابقة." : "No clinics match."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {data && <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} isAr={isAr} />}
    </div>
  );
}
