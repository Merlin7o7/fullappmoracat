"use client";

/**
 * Today — the working home of the vet portal (MRC-VET-001 §04).
 *
 * Named "Today", not "Dashboard", because it answers the question a clinic
 * actually has at 9am: what's happening right now, and is anything waiting on
 * me? It is supporting cast to the omnibox in the bar above — a working
 * surface, never a vanity chart wall.
 *
 * The honesty rule that shapes this file: **nothing here is invented.** The
 * summary endpoint may not exist yet; when it doesn't, the stat cards simply
 * aren't rendered. A clinic that sees a fabricated number once never trusts the
 * real ones again (R006).
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ClipboardList,
  Clock,
  ScanLine,
  ShieldAlert,
  Syringe,
  Users,
} from "lucide-react";
import { Badge, Button, Card, Skeleton, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { formatSAR } from "@/lib/money";
import {
  readRecentLookups,
  useVetActor,
  useVetApi,
  vetFriendlyError,
  vetOrgName,
  vetVisitStateLabel,
  type VetRecentLookup,
  type VetVisit,
} from "@/lib/vet-api";
import { EmptyState, PatientRow, SectionCard } from "@/components/vet/vet-shell-bits";

export default function VetTodayPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const loc = isAr ? "ar" : "en";
  const router = useRouter();
  const { user } = useAuth();
  const api = useVetApi();
  const { orgId, org, branchId, can, counterMode, counterSession } = useVetActor();

  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  const visitsQuery = useQuery({
    queryKey: ["vet", "visits", orgId, branchId, today],
    queryFn: () => api.listVisits({ date: today, branchId: branchId ?? undefined }),
    enabled: !!orgId && can("visit.open"),
    refetchInterval: 60_000, // the queue is a live thing
  });

  // Deliberately soft: a missing summary hides its cards, it never shouts.
  const summaryQuery = useQuery({
    queryKey: ["vet", "summary", orgId, branchId],
    queryFn: () => api.getOrgSummary(),
    enabled: !!orgId,
    retry: 0,
  });

  const [recents, setRecents] = React.useState<VetRecentLookup[]>([]);
  React.useEffect(() => setRecents(readRecentLookups()), []);

  const summary = summaryQuery.data ?? null;
  const visits = visitsQuery.data?.visits ?? [];
  const openVisits = visits.filter((v) => v.state === "WAITING" || v.state === "IN_PROGRESS");
  const completedCount =
    visitsQuery.data?.counts?.completed ?? visits.filter((v) => v.state === "COMPLETED").length;

  const greetingName = counterSession?.staffName ?? user?.firstName ?? null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      {/* ── The line that orients the shift ── */}
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold leading-tight sm:text-2xl">
            {greeting(isAr, greetingName)}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>{formatDate(new Date(), loc, { weekday: "long", day: "numeric", month: "long" })}</span>
            {org && <span className="truncate">· {vetOrgName(org, isAr)}</span>}
            {counterMode && (
              <Badge variant="info" dot>
                {isAr ? "وضع الكاونتر" : "Counter mode"}
              </Badge>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="brand" onClick={() => router.push("/vet/scan")}>
            <ScanLine className="size-4" aria-hidden />
            {isAr ? "امسح بطاقة" : "Scan a card"}
          </Button>
          {can("emergency.access") && (
            <Button size="sm" variant="outline" onClick={() => router.push("/vet/emergency")}>
              <ShieldAlert className="size-4" aria-hidden />
              {isAr ? "طوارئ" : "Emergency"}
            </Button>
          )}
        </div>
      </header>

      {/* ── Needs attention: the only thing allowed to interrupt ── */}
      {summary?.attention?.length ? (
        <div className="flex flex-col gap-2">
          {summary.attention.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm",
                item.severity === "CRITICAL"
                  ? "border-destructive/30 bg-destructive/[0.07]"
                  : item.severity === "WARN"
                    ? "border-warning/40 bg-warning/[0.09]"
                    : "border-border bg-muted/50",
              )}
              role={item.severity === "CRITICAL" ? "alert" : "status"}
            >
              <span className="flex min-w-0 items-center gap-2">
                <AlertTriangle
                  className={cn(
                    "size-4 shrink-0",
                    item.severity === "CRITICAL" ? "text-destructive" : "text-warning",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 font-medium">{isAr ? item.titleAr : item.titleEn}</span>
              </span>
              {item.href && (
                <Link
                  href={item.href}
                  className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
                >
                  {(isAr ? item.actionAr : item.actionEn) ?? (isAr ? "افتحها" : "Open")}
                  <ArrowRight className="size-3.5 ltr:rotate-0 rtl:rotate-180" aria-hidden />
                </Link>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Answers, not charts. Rendered only where a real number exists. ── */}
      {summaryQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-20" />
            </Card>
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {summary.visitsToday && (
            <StatCard
              label={isAr ? "زيارات أعضاء مرقط اليوم" : "Moracat visits today"}
              value={String(summary.visitsToday.open + summary.visitsToday.completed)}
              hint={
                isAr
                  ? `${summary.visitsToday.open} مفتوحة · ${summary.visitsToday.completed} مكتملة`
                  : `${summary.visitsToday.open} open · ${summary.visitsToday.completed} completed`
              }
              icon={ClipboardList}
            />
          )}
          {summary.benefitHonouredThisMonth && (
            <StatCard
              label={isAr ? "أسعار الأعضاء المُكرَّمة هذا الشهر" : "Member rates honoured this month"}
              value={formatSAR(summary.benefitHonouredThisMonth.amount, isAr)}
              hint={
                isAr
                  ? `عبر ${summary.benefitHonouredThisMonth.visits} زيارة`
                  : `across ${summary.benefitHonouredThisMonth.visits} visits`
              }
              icon={Users}
            />
          )}
          {typeof summary.newMembersNearby === "number" && (
            <StatCard
              label={isAr ? "أعضاء جدد قريبون منك" : "New members nearby"}
              value={String(summary.newMembersNearby)}
              hint={isAr ? "انضموا هذا الشهر" : "joined this month"}
              icon={Users}
            />
          )}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        {/* ── The queue: the only list that matters at 9am ── */}
        <SectionCard
          title={isAr ? "الزيارات المفتوحة" : "Open visits"}
          hint={
            visitsQuery.data
              ? isAr
                ? `${openVisits.length} مفتوحة · ${completedCount} مكتملة اليوم`
                : `${openVisits.length} open · ${completedCount} completed today`
              : undefined
          }
          icon={ClipboardList}
          action={
            can("visit.open") ? (
              <Link
                href="/vet/visits"
                className="inline-flex min-h-[44px] items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                {isAr ? "كل الزيارات" : "All visits"}
                <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
              </Link>
            ) : null
          }
          contentClassName="p-2"
        >
          {!can("visit.open") ? (
            <EmptyState
              tone="boundary"
              icon={ClipboardList}
              title={isAr ? "الزيارات خارج نطاق دورك" : "Visits aren't part of your role"}
              body={
                isAr
                  ? "مدير العيادة يقدر يوسّع صلاحياتك إذا احتجت متابعة الطابور."
                  : "A clinic manager can widen your access if you need the queue."
              }
            />
          ) : visitsQuery.isLoading ? (
            <VisitSkeletons />
          ) : visitsQuery.isError ? (
            <EmptyState
              icon={Clock}
              title={vetFriendlyError(visitsQuery.error, isAr).title}
              body={vetFriendlyError(visitsQuery.error, isAr).message}
              action={
                <Button size="sm" variant="outline" onClick={() => void visitsQuery.refetch()} loading={visitsQuery.isFetching}>
                  {isAr ? "أعد المحاولة" : "Try again"}
                </Button>
              }
            />
          ) : openVisits.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title={isAr ? "الكاونتر جاهز" : "Your counter is ready"}
              body={
                isAr
                  ? "أول ما تُمسح بطاقة عضو، تبدأ هذه الصفحة تمتلئ بنفسها."
                  : "The first time a member's card is scanned, this page starts filling itself."
              }
              action={
                <Button size="sm" variant="outline" onClick={() => router.push("/vet/scan")}>
                  <ScanLine className="size-4" aria-hidden />
                  {isAr ? "جرّب مسحاً" : "Try a scan"}
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-0.5">
              {openVisits.map((v) => (
                <li key={v.id}>
                  <VisitRow visit={v} isAr={isAr} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="flex flex-col gap-4">
          {/* ── Recent lookups: the regulars at the counter ── */}
          <SectionCard
            title={isAr ? "آخر من بحثت عنهم" : "Recent patients"}
            hint={isAr ? "على هذا الجهاز، لمدة يوم" : "On this device, for a day"}
            icon={Clock}
            contentClassName="p-2"
          >
            {recents.length === 0 ? (
              <EmptyState
                icon={Clock}
                title={isAr ? "لا شيء بعد على هذا الجهاز" : "Nothing on this device yet"}
                body={
                  isAr
                    ? "من تبحث عنه يظهر هنا ليوم واحد، ثم يُمسح — الجهاز مشترك، والذاكرة قصيرة عمداً."
                    : "Whoever you look up appears here for a day, then clears itself — the terminal is shared, so the memory is deliberately short."
                }
              />
            ) : (
              <ul className="flex flex-col gap-0.5">
                {recents.map((r) => (
                  <li key={r.catId}>
                    <PatientRow
                      name={r.name}
                      catIdNumber={r.catIdNumber}
                      photoUrl={r.photoUrl}
                      href={`/vet/patients/${encodeURIComponent(r.catId)}`}
                      size="sm"
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* ── Follow-ups the clinic promised ── */}
          {summary?.pendingFollowUps && summary.pendingFollowUps.length > 0 && can("patient.view") && (
            <SectionCard
              title={isAr ? "متابعات معلّقة" : "Pending follow-ups"}
              hint={isAr ? "وعود قطعتها العيادة" : "Promises the clinic made"}
              icon={CalendarClock}
              contentClassName="p-2"
            >
              <ul className="flex flex-col gap-0.5">
                {summary.pendingFollowUps.map((f) => (
                  <li key={f.id}>
                    <PatientRow
                      name={f.catName}
                      photoUrl={f.catPhotoUrl}
                      size="sm"
                      href={`/vet/patients/${encodeURIComponent(f.catId)}`}
                      meta={
                        <>
                          <span className="truncate">{formatDate(f.dueAt, loc)}</span>
                          {(isAr ? f.reasonAr : f.reasonEn) && (
                            <span className="truncate">{isAr ? f.reasonAr : f.reasonEn}</span>
                          )}
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* ── Vaccinations due: the recall list clinics love ── */}
          {summary?.vaccinationsDue && summary.vaccinationsDue.length > 0 && can("patient.view") && (
            <SectionCard
              title={isAr ? "تطعيمات مستحقة" : "Vaccinations due"}
              hint={isAr ? "من مرضى عيادتك" : "Among your clinic's patients"}
              icon={Syringe}
              contentClassName="p-2"
            >
              <ul className="flex flex-col gap-0.5">
                {summary.vaccinationsDue.map((v) => (
                  <li key={`${v.catId}-${v.vaccineEn}-${v.dueAt}`}>
                    <PatientRow
                      name={v.catName}
                      photoUrl={v.catPhotoUrl}
                      size="sm"
                      href={`/vet/patients/${encodeURIComponent(v.catId)}`}
                      meta={
                        <>
                          <span className="truncate">{isAr ? v.vaccineAr : v.vaccineEn}</span>
                          <span className="truncate">{formatDate(v.dueAt, loc)}</span>
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="flex items-start gap-3 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground" aria-hidden>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-display text-xl font-semibold leading-tight tabular">{value}</p>
        {hint && <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}

function VisitRow({ visit, isAr }: { visit: VetVisit; isAr: boolean }) {
  const loc = isAr ? "ar" : "en";
  const waitingMinutes = Math.max(
    0,
    Math.round((Date.now() - new Date(visit.checkedInAt).getTime()) / 60000),
  );
  return (
    <PatientRow
      name={visit.catName}
      catIdNumber={visit.catIdNumber}
      photoUrl={visit.catPhotoUrl}
      href={`/vet/visits/${encodeURIComponent(visit.id)}`}
      meta={
        <>
          <span className="truncate">
            {formatDateTime(visit.checkedInAt, loc, { hour: "2-digit", minute: "2-digit" })}
          </span>
          {(isAr ? visit.reasonAr : visit.reasonEn) && (
            <span className="truncate">{isAr ? visit.reasonAr : visit.reasonEn}</span>
          )}
          {visit.assignedStaffName && <span className="truncate">{visit.assignedStaffName}</span>}
        </>
      }
      trailing={
        <span className="flex flex-col items-end gap-0.5">
          <Badge variant={visit.state === "IN_PROGRESS" ? "info" : "warning"} dot>
            {vetVisitStateLabel(visit.state, isAr)}
          </Badge>
          {visit.state === "WAITING" && (
            <span className="text-[0.625rem] text-muted-foreground tabular">
              {isAr ? `${waitingMinutes} د` : `${waitingMinutes} min`}
            </span>
          )}
        </span>
      }
    />
  );
}

function VisitSkeletons() {
  return (
    <div className="flex flex-col gap-1 p-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="size-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Time-of-day greeting — warm, plain, and never over-familiar (R081). */
function greeting(isAr: boolean, name?: string | null): string {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  if (isAr) {
    const base = part === "morning" ? "صباح الخير" : part === "afternoon" ? "مساء الخير" : "مساء الخير";
    return name ? `${base}، ${name}` : base;
  }
  const base = part === "morning" ? "Good morning" : part === "afternoon" ? "Good afternoon" : "Good evening";
  return name ? `${base}, ${name}` : base;
}
