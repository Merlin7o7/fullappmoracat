"use client";

/**
 * Branches — what members will see in the directory (MRC-VET-001 §16).
 *
 * Read-only here on purpose: public directory copy is reviewed by Moracat
 * before it changes (curation continues after signing), so this screen shows
 * the truth and names the way to change it, rather than a form whose edits
 * would silently wait in a queue (R006). The one write is the go-live
 * confirmation — "yes, this is right" — which an APPROVED clinic needs.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, MapPin, Phone, Siren, Store } from "lucide-react";
import { Badge, Button, Skeleton, cn, useToast } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { formatDate } from "@/lib/datetime";
import { useVetActor, useVetFetch } from "@/lib/vet-api";
import type { OnboardingState } from "@/lib/vet-registration";
import { EmptyState, SectionCard } from "@/components/vet/vet-shell-bits";
import { InlineError } from "./confirm-dialog";
import { settingsError } from "./errors";
import type { OrgBranch } from "./types";
import { useOnboarding, useSetOnboarding } from "./use-onboarding";

const PARTNERS_EMAIL = "partners@moracat.co";

const DAYS = [
  { ar: "الأحد", en: "Sun" },
  { ar: "الاثنين", en: "Mon" },
  { ar: "الثلاثاء", en: "Tue" },
  { ar: "الأربعاء", en: "Wed" },
  { ar: "الخميس", en: "Thu" },
  { ar: "الجمعة", en: "Fri" },
  { ar: "السبت", en: "Sat" },
];

export function branchesQueryKey(orgId: string | null) {
  return ["vet", "org", "branches", orgId] as const;
}

export function useBranches() {
  const vetFetch = useVetFetch();
  const { orgId } = useVetActor();
  return useQuery({
    queryKey: branchesQueryKey(orgId),
    queryFn: () => vetFetch<{ items: OrgBranch[] }>("/vet/org/branches"),
    enabled: !!orgId,
  });
}

export function BranchesSection() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { toast } = useToast();
  const vetFetch = useVetFetch();
  const { org, can } = useVetActor();
  const branches = useBranches();
  const onboarding = useOnboarding();
  const setOnboarding = useSetOnboarding();

  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<{ title: string; message: string } | null>(null);

  const inSetup = org?.org.status === "APPROVED";
  const confirmedAt = onboarding.data?.items.branches.at ?? null;

  async function confirm() {
    setConfirming(true);
    setError(null);
    try {
      const state = await vetFetch<OnboardingState>("/vet/org/onboarding/confirm-branches", {
        method: "POST",
        body: "{}",
      });
      setOnboarding(state);
      toast({
        title: isAr ? "أُكّدت بيانات الفروع" : "Branch details confirmed",
        description: isAr ? "بند واحد أقل في قائمة التجهيز." : "One less item on the setup checklist.",
        variant: "success",
      });
    } catch (err) {
      setError(settingsError(err, isAr));
    } finally {
      setConfirming(false);
    }
  }

  const items = branches.data?.items ?? [];

  return (
    <SectionCard
      title={isAr ? "الفروع" : "Branches"}
      hint={
        isAr
          ? "هذا ما يراه الأعضاء في دليل العيادات."
          : "This is what members see in the clinic directory."
      }
      icon={Store}
    >
      {branches.isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-border p-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-3 h-3 w-64" />
              <Skeleton className="mt-2 h-3 w-48" />
            </div>
          ))}
        </div>
      ) : branches.isError ? (
        <EmptyState
          icon={Store}
          title={settingsError(branches.error, isAr).title}
          body={settingsError(branches.error, isAr).message}
          action={
            <Button size="sm" variant="outline" onClick={() => void branches.refetch()} loading={branches.isFetching}>
              {isAr ? "أعد المحاولة" : "Try again"}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Store}
          title={isAr ? "لا فروع في نطاقك" : "No branches in your scope"}
          body={
            isAr
              ? "الفروع تُضاف أثناء تسجيل العيادة. إن كان هذا غير متوقع، راسل فريق الشراكات."
              : "Branches are added during clinic registration. If this is unexpected, write to the partnerships team."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-3">
            {items.map((b) => (
              <li key={b.id}>
                <BranchCard branch={b} isAr={isAr} />
              </li>
            ))}
          </ul>

          <p className="text-xs leading-relaxed text-muted-foreground">
            {isAr ? "تحتاج تعديلاً؟ راسل " : "Need a change? Write to "}
            <a
              href={`mailto:${PARTNERS_EMAIL}`}
              dir="ltr"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {PARTNERS_EMAIL}
            </a>
            {isAr
              ? " — نراجع بيانات الدليل قبل نشرها، حفاظاً على ثقة الأعضاء."
              : " — directory details are reviewed before they go public, to keep members' trust."}
          </p>

          {inSetup && can("branch.manage") && (
            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3",
                confirmedAt ? "border-success/30 bg-success/[0.06]" : "border-border bg-muted/40",
              )}
            >
              {confirmedAt ? (
                <p className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                  {isAr
                    ? `أكّدت البيانات في ${formatDate(confirmedAt, "ar")}`
                    : `Confirmed on ${formatDate(confirmedAt, "en")}`}
                </p>
              ) : (
                <>
                  <p className="text-sm">
                    {isAr
                      ? "راجع الأسماء والعناوين وأوقات العمل أعلاه. صحيحة؟"
                      : "Check the names, addresses and hours above. All correct?"}
                  </p>
                  <Button size="sm" variant="brand" onClick={() => void confirm()} loading={confirming}>
                    <CheckCircle2 className="size-4" aria-hidden />
                    {isAr ? "أؤكد صحة البيانات" : "Confirm details"}
                  </Button>
                </>
              )}
            </div>
          )}
          <InlineError error={error} />
        </div>
      )}
    </SectionCard>
  );
}

function BranchCard({ branch: b, isAr }: { branch: OrgBranch; isAr: boolean }) {
  const loc = isAr ? "ar" : "en";
  const name = (isAr ? b.nameAr || b.nameEn : b.nameEn || b.nameAr) || "—";
  const city = b.city ? (isAr ? b.city.nameAr : b.city.nameEn) : null;
  const licence = licenceState(b.licenceExpiresAt);
  const hours = normaliseHours(b.hours);

  return (
    <div className={cn("rounded-xl border border-border p-4", !b.isActive && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-tight">{name}</p>
          {(city || b.addressLine) && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{[city, b.addressLine].filter(Boolean).join(isAr ? "، " : ", ")}</span>
            </p>
          )}
          {b.phone && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="size-3.5 shrink-0" aria-hidden />
              <a href={`tel:${b.phone}`} dir="ltr" className="tabular hover:text-foreground">
                {b.phone}
              </a>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!b.isActive && <Badge variant="secondary">{isAr ? "مغلق" : "Closed"}</Badge>}
          {b.emergency24h && (
            <Badge variant="info">
              <Siren className="size-3" aria-hidden />
              {isAr ? "طوارئ ٢٤ ساعة" : "24h emergency"}
            </Badge>
          )}
          <Badge variant={b.directoryVisible ? "success" : "secondary"} dot>
            {b.directoryVisible
              ? isAr
                ? "ظاهر في الدليل"
                : "In the directory"
              : isAr
                ? "غير ظاهر في الدليل"
                : "Not in the directory"}
          </Badge>
        </div>
      </div>

      {hours.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="size-3.5" aria-hidden />
            {isAr ? "أوقات العمل" : "Opening hours"}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs sm:grid-cols-[auto_1fr_auto_1fr]">
            {hours.map((h) => (
              <React.Fragment key={h.day}>
                <dt className="text-muted-foreground">{DAYS[h.day]?.[loc] ?? h.day}</dt>
                <dd className="tabular">
                  {h.closed || (!h.open && !h.close) ? (
                    isAr ? "مغلق" : "Closed"
                  ) : (
                    <span dir="ltr">
                      {h.open ?? "—"}–{h.close ?? "—"}
                    </span>
                  )}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-3 text-xs">
        <span className="text-muted-foreground">{isAr ? "ترخيص المنشأة البيطرية" : "Veterinary facility licence"}</span>
        {b.licenceNo ? (
          <span dir="ltr" className="font-mono">
            {b.licenceNo}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        {b.licenceExpiresAt && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
              licence === "expired" || licence === "critical"
                ? "bg-destructive/10 text-destructive"
                : licence === "soon"
                  ? "bg-warning/15 text-[hsl(38_92%_26%)] dark:text-warning-ink"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {licence !== "ok" && <AlertTriangle className="size-3" aria-hidden />}
            {licence === "expired"
              ? isAr
                ? `انتهى في ${formatDate(b.licenceExpiresAt, loc)}`
                : `Expired ${formatDate(b.licenceExpiresAt, loc)}`
              : isAr
                ? `ينتهي ${formatDate(b.licenceExpiresAt, loc)}`
                : `Expires ${formatDate(b.licenceExpiresAt, loc)}`}
          </span>
        )}
      </div>
      {(licence === "expired" || licence === "critical") && (
        <p className="mt-2 text-xs text-destructive">
          {isAr
            ? "الترخيص المنتهي يُخفي الفرع من دليل العيادات. ارفع الترخيص المجدّد لفريق الشراكات."
            : "An expired licence hides the branch from the directory. Send the renewed licence to the partnerships team."}
        </p>
      )}
    </div>
  );
}

/** 60 / 30 / 7-day warning ladder (MRC-VET-002 §Phase 5, "Ongoing"). */
function licenceState(iso: string | null): "ok" | "soon" | "critical" | "expired" {
  if (!iso) return "ok";
  const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "expired";
  if (days <= 7) return "critical";
  if (days <= 60) return "soon";
  return "ok";
}

type Hour = { day: number; open?: string; close?: string; closed?: boolean };

function normaliseHours(raw: unknown): Hour[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (h): h is Hour =>
        !!h && typeof h === "object" && typeof (h as Hour).day === "number" && (h as Hour).day >= 0 && (h as Hour).day <= 6,
    )
    .sort((a, b) => a.day - b.day);
}
