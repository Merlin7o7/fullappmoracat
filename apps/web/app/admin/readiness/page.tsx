"use client";

/**
 * /admin/readiness — is the machine actually running? (audit 2026-10-04,
 * Problem 7: "reminders depend on a GitHub Actions cron that exits quietly
 * if its secrets are missing").
 *
 * Goes red when a scheduled job's last CLEAN finish is older than its
 * cadence (two hours for the hourly care/lifecycle jobs, eight days for the
 * weekly digest) or when its last run failed. Staff-only: the admin layout
 * gates the page and GET /admin/readiness requires dashboard.read. This is
 * where job timestamps and error text live — the public /health now says
 * only "ok" or "stale".
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, OctagonAlert, RefreshCw } from "lucide-react";
import { Button, Card, Ledger, LedgerRow, Skeleton, StatusTag, type StatusTone } from "@moraqat/ui";
import { formatDate, formatRelative } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { QueryError } from "@/components/query-error";
import { ReadinessCard } from "../_components/readiness-card";

interface JobHealth {
  name: string;
  status: "ok" | "stale" | "failed" | "never";
  maxAgeHours: number;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
}

const JOB_LABEL: Record<string, { ar: string; en: string }> = {
  care: { ar: "تذكيرات الرعاية", en: "Care reminders" },
  lifecycle: { ar: "دورة الاشتراكات والتنبيهات", en: "Lifecycle notices" },
  fulfilment: { ar: "تجهيز الصناديق", en: "Box fulfilment" },
  digest: { ar: "الملخص الأسبوعي", en: "Weekly digest" },
};

const STATUS: Record<JobHealth["status"], { tone: StatusTone; ar: string; en: string }> = {
  ok: { tone: "positive", ar: "يعمل", en: "Running" },
  stale: { tone: "critical", ar: "متأخر", en: "Stale" },
  failed: { tone: "critical", ar: "فشل آخر تشغيل", en: "Last run failed" },
  never: { tone: "attention", ar: "لم يعمل بعد", en: "Never ran" },
};

export default function AdminReadinessPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const loc = isAr ? "ar" : "en";
  const q = useQuery({
    queryKey: ["admin-readiness", user?.id],
    queryFn: () => authedFetch<{ jobs?: JobHealth[] }>("/admin/readiness"),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const jobs = q.data?.jobs ?? [];
  const unhealthy = jobs.filter((j) => j.status !== "ok");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{isAr ? "الجاهزية" : "Readiness"}</h1>
          <p className="text-sm text-muted-foreground">
            {isAr ? "هل المهام المجدولة تعمل فعلاً، وما الذي ينقص قبل الإطلاق." : "Are the scheduled jobs really running, and what's missing before launch."}
          </p>
        </div>
        <Button variant="secondary" onClick={() => q.refetch()} loading={q.isFetching}>
          <RefreshCw aria-hidden /> {isAr ? "حدّث" : "Refresh"}
        </Button>
      </header>

      <Card className="p-5">
        <h2 className="mb-1 font-display text-lg">{isAr ? "المهام المجدولة" : "Scheduled jobs"}</h2>
        {q.isLoading ? (
          <div className="space-y-2 pt-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : q.isError ? (
          <QueryError isAr={isAr} onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : (
          <>
            <p role="status" className="mb-3 flex items-center gap-2 text-sm">
              {unhealthy.length ? (
                <>
                  <OctagonAlert className="size-5 text-destructive" aria-hidden />
                  <span className="font-medium text-destructive">
                    {isAr
                      ? `غير سليم — ${unhealthy.length} من ${jobs.length} لم ينهِ تشغيلاً ناجحاً في موعده. التذكيرات لا تصل للأعضاء.`
                      : `Unhealthy — ${unhealthy.length} of ${jobs.length} haven't finished a clean run on time. Members aren't getting reminders.`}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-5 text-success" aria-hidden />
                  <span>{isAr ? "سليم — كل المهام أنهت تشغيلاً ناجحاً في موعدها." : "Healthy — every job finished cleanly on time."}</span>
                </>
              )}
            </p>
            <Ledger>
              {jobs.map((j) => {
                const st = STATUS[j.status];
                const label = JOB_LABEL[j.name] ?? { ar: j.name, en: j.name };
                return (
                  <LedgerRow
                    key={j.name}
                    label={
                      <span>
                        {isAr ? label.ar : label.en}
                        <span className="block font-mono text-xs" dir="ltr">{j.name}</span>
                      </span>
                    }
                    value={<StatusTag tone={st.tone}>{isAr ? st.ar : st.en}</StatusTag>}
                    hint={
                      <>
                        {j.lastFinishedAt
                          ? isAr
                            ? `آخر انتهاء ${formatRelative(j.lastFinishedAt, loc)} (${formatDate(j.lastFinishedAt, loc, "medium")})`
                            : `Last finished ${formatRelative(j.lastFinishedAt, loc)} (${formatDate(j.lastFinishedAt, loc, "medium")})`
                          : isAr ? "لا يوجد سجل تشغيل" : "No run on record"}
                        {" · "}
                        {isAr ? `المسموح ${j.maxAgeHours} ساعة` : `allowed ${j.maxAgeHours}h`}
                        {j.lastError && <span className="mt-1 block break-words text-destructive" dir="ltr">{j.lastError}</span>}
                      </>
                    }
                  />
                );
              })}
            </Ledger>
            {unhealthy.length > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                {isAr
                  ? "الإصلاح: تأكد من CRON_SECRET على Render ومن MORACAT_API_URL و CRON_SECRET في أسرار GitHub، ثم شغّل workflow «cron» يدوياً من تبويب Actions وراجع النتيجة هنا."
                  : "Fix: check CRON_SECRET on Render and MORACAT_API_URL + CRON_SECRET in GitHub secrets, then run the \"cron\" workflow by hand from the Actions tab and re-check here."}
              </p>
            )}
          </>
        )}
      </Card>

      <ReadinessCard />
    </div>
  );
}
