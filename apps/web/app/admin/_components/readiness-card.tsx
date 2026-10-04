"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, OctagonAlert, ChevronDown } from "lucide-react";
import { Card, Skeleton } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";

type Level = "ok" | "warn" | "block";
interface Check {
  key: string;
  level: Level;
  titleAr: string;
  titleEn: string;
  fixAr: string;
  fixEn: string;
  owner: "ops" | "counsel" | "vet";
}

const OWNER: Record<Check["owner"], { ar: string; en: string }> = {
  ops: { ar: "تشغيل", en: "Ops" },
  counsel: { ar: "محامٍ", en: "Counsel" },
  vet: { ar: "طبيب بيطري", en: "Vet" },
};

const ICON: Record<Level, { Icon: typeof CheckCircle2; cls: string; ar: string; en: string }> = {
  block: { Icon: OctagonAlert, cls: "text-destructive", ar: "يمنع الإطلاق", en: "Blocks launch" },
  warn: { Icon: AlertTriangle, cls: "text-warning-ink", ar: "ناقص", en: "Missing" },
  ok: { Icon: CheckCircle2, cls: "text-success", ar: "جاهز", en: "Ready" },
};

/**
 * Launch readiness — every gap that used to fail silently (public health
 * documents, partner emails to nobody, a placeholder salt, a city-less clinic)
 * plus the sign-offs no deploy can make. Blocking items first; "ready" items
 * fold away so the list stays a to-do, not a report.
 */
export function ReadinessCard() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [showOk, setShowOk] = React.useState(false);
  const q = useQuery({
    queryKey: ["admin-readiness", user?.id],
    queryFn: () => authedFetch<{ checks: Check[]; summary: Record<Level, number> }>("/admin/readiness"),
    enabled: !!user,
    staleTime: 60_000,
  });

  const order: Record<Level, number> = { block: 0, warn: 1, ok: 2 };
  const checks = [...(q.data?.checks ?? [])].sort((a, b) => order[a.level] - order[b.level]);
  const open = checks.filter((c) => c.level !== "ok");
  const ready = checks.filter((c) => c.level === "ok");

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-lg">{isAr ? "جاهزية الإطلاق" : "Launch readiness"}</h2>
          <p className="text-sm text-muted-foreground">
            {isAr ? "ما يحتاج قراراً أو إعداداً قبل أن نعتمد عليه." : "What still needs a setting or a decision before we rely on it."}{" "}
            <Link href="/admin/readiness" className="font-medium text-primary underline-offset-4 hover:underline">
              {isAr ? "صحة المهام المجدولة" : "Scheduled-job health"}
            </Link>
          </p>
        </div>
        {q.data && (
          <p className="text-sm tabular text-muted-foreground">
            {isAr
              ? `${q.data.summary.block} يمنع · ${q.data.summary.warn} ناقص · ${q.data.summary.ok} جاهز`
              : `${q.data.summary.block} blocking · ${q.data.summary.warn} missing · ${q.data.summary.ok} ready`}
          </p>
        )}
      </div>

      {q.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : q.isError ? (
        <p className="text-sm text-muted-foreground">{isAr ? "تعذّر تحميل القائمة." : "Couldn't load the checklist."}</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {open.map((c) => (
              <Row key={c.key} c={c} isAr={isAr} />
            ))}
          </ul>
          {ready.length > 0 && (
            <button
              type="button"
              onClick={() => setShowOk((v) => !v)}
              aria-expanded={showOk}
              className="mt-3 inline-flex min-h-[44px] items-center gap-1 rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronDown aria-hidden className={`size-4 transition-transform ${showOk ? "rotate-180" : ""}`} />
              {isAr ? `${ready.length} جاهز` : `${ready.length} ready`}
            </button>
          )}
          {showOk && (
            <ul className="divide-y divide-border">
              {ready.map((c) => (
                <Row key={c.key} c={c} isAr={isAr} />
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

function Row({ c, isAr }: { c: Check; isAr: boolean }) {
  const { Icon, cls, ar, en } = ICON[c.level];
  return (
    <li className="flex gap-3 py-3">
      <Icon aria-hidden className={`mt-0.5 size-5 shrink-0 ${cls}`} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {isAr ? c.titleAr : c.titleEn}
          <span className="sr-only">— {isAr ? ar : en}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
            {isAr ? OWNER[c.owner].ar : OWNER[c.owner].en}
          </span>
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{isAr ? c.fixAr : c.fixEn}</p>
      </div>
    </li>
  );
}
