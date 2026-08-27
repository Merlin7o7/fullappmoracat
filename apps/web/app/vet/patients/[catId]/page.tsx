"use client";

// ════════════════════════════════════════════════════════════════════════
//  The cat profile — clinic view (MRC-VET-001 §06).
//
//  Design law, verbatim: "The profile a vet sees is NOT the owner's profile
//  with extra buttons — it is a clinical chart with a membership header,
//  filtered through the owner's consent. Layout priority: identity → alerts
//  → the tab a vet needs → history."
//
//  Three promises this page is built around:
//
//  1. ALERTS ARE NEVER HIDDEN. The alerts band sits directly under the hero,
//     above the consent banner, above the tabs, and renders identically at
//     every tier — including for a receptionist who cannot read one line of
//     the clinical record. Tier-0 is not a permission level here; it is a
//     safety floor.
//
//  2. CONSENT IS STATED, NEVER SIMULATED. The banner names the tier this
//     clinic holds, names what that tier withholds, and offers one tap to
//     ask the owner. It never renders an empty panel that could be misread
//     as "no history" — silence about missing data is the one lie a medical
//     UI cannot tell.
//
//  3. ROLE SHAPES THE PAGE, NOT JUST THE BUTTONS. A receptionist gets the
//     identity, the alerts and "start visit" — and no record tabs at all,
//     because the capability matrix makes that structurally true (§14).
//
//  Performance: the four panels are code-split and only mounted once their
//  tab opens, so a counter tablet loads a hero and a band, not a chart and a
//  decade of history.
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  CalendarDays,
  Cat,
  Eye,
  Images,
  ListOrdered,
  Lock,
  Phone,
  Siren,
  Stethoscope,
  Syringe,
  Unlock,
  Weight,
} from "lucide-react";
import { Badge, Button, buttonVariants, Card, Dialog, Input, Skeleton, cn, useToast } from "@moraqat/ui";
import { VET_ROLE_LABELS } from "@moraqat/core";
import { useLocale } from "@/app/providers";
import { formatDate } from "@/lib/datetime";
import { QueryError } from "@/components/query-error";
import {
  AlertsBand,
  deriveMissingVaccinations,
  vaccinationStanding,
  vaccinationStandingLabel,
} from "@/components/vet/alerts-band";
import {
  formatCatAge,
  useVetActor,
  useVetApi,
  vetFriendlyError,
  type ConsentTier,
  type PatientProfile,
  flattenTier0Alerts,
} from "@/lib/vet-api";

// Panels are code-split: nothing below the alerts band is in the first paint.
const panelLoading = () => (
  <div className="space-y-3" aria-hidden>
    <Skeleton className="h-24 rounded-2xl" />
    <Skeleton className="h-24 rounded-2xl" />
  </div>
);
const TimelinePanel = dynamic(() => import("./timeline-panel"), { loading: panelLoading, ssr: false });
const RecordsPanel = dynamic(() => import("./records-panel"), { loading: panelLoading, ssr: false });
const ChartsPanel = dynamic(() => import("./charts-panel"), { loading: panelLoading, ssr: false });
const GalleryPanel = dynamic(() => import("./gallery-panel"), { loading: panelLoading, ssr: false });

type TabKey = "records" | "timeline" | "charts" | "gallery";

const TABS: { key: TabKey; ar: string; en: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "records", ar: "الملف الصحي", en: "Health", icon: Stethoscope },
  { key: "timeline", ar: "السجل الزمني", en: "Timeline", icon: ListOrdered },
  { key: "charts", ar: "المنحنيات", en: "Charts", icon: Activity },
  { key: "gallery", ar: "الصور", en: "Images", icon: Images },
];

export default function PatientProfilePage({ params }: { params: { catId: string } }) {
  const { catId } = params;
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const actor = useVetActor();
  const api = useVetApi();

  // Health leads — §06: "the tab a vet needs (Health)".
  const [tab, setTab] = React.useState<TabKey>("records");
  // Tabs mount on first open and stay mounted, so switching back is instant
  // and never refetches mid-consult.
  const [opened, setOpened] = React.useState<Set<TabKey>>(() => new Set<TabKey>(["records"]));

  const query = useQuery({
    queryKey: ["vet-patient", catId],
    queryFn: () => api.getPatient(catId),
    // A clinic must be chosen before any patient call can be scoped.
    enabled: actor.ready && !!actor.orgId,
  });

  function openTab(key: TabKey) {
    setTab(key);
    setOpened((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }

  // No clinic selected yet — the shell's org switcher is the next action, and
  // a half-rendered chart would be worse than an honest wait.
  if (!actor.ready || !actor.orgId) return <ProfileSkeleton />;
  if (query.isLoading) return <ProfileSkeleton />;
  if (query.isError)
    return (
      <div className="mx-auto max-w-5xl p-4">
        <QueryError isAr={isAr} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </div>
    );

  const profile = query.data!;
  const missing = deriveMissingVaccinations(profile.vaccinations, isAr);
  const canReadRecords = actor.can("record.read");

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-3 pb-24 sm:p-5">
      <Hero profile={profile} missing={missing} />

      {/* ── The safety floor. Above everything. Always. ─────────────────── */}
      <AlertsBand alerts={flattenTier0Alerts(profile.alerts)} missingVaccinations={missing} catName={profile.name} />

      <ConsentBanner profile={profile} catId={catId} />

      <QuickActions profile={profile} catId={catId} />

      {/* ── Clinical tabs — only for roles that may read the record. ────── */}
      {canReadRecords ? (
        <div>
          <div
            role="tablist"
            aria-label={isAr ? "أقسام السجل" : "Record sections"}
            className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1"
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              // Arrow keys follow reading order — mirrored in Arabic (R104).
              const forward = isAr ? e.key === "ArrowLeft" : e.key === "ArrowRight";
              const i = TABS.findIndex((t) => t.key === tab);
              const next = TABS[(i + (forward ? 1 : TABS.length - 1)) % TABS.length];
              if (!next) return;
              openTab(next.key);
              document.getElementById(`vet-tab-${next.key}`)?.focus();
            }}
          >
            {TABS.map((t) => {
              const active = t.key === tab;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  id={`vet-tab-${t.key}`}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  aria-controls={`vet-panel-${t.key}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => openTab(t.key)}
                  className={cn(
                    "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {isAr ? t.ar : t.en}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            {TABS.map((t) => (
              <div
                key={t.key}
                id={`vet-panel-${t.key}`}
                role="tabpanel"
                aria-labelledby={`vet-tab-${t.key}`}
                hidden={tab !== t.key}
                tabIndex={0}
              >
                {opened.has(t.key) && (
                  <>
                    {t.key === "records" && (
                      <RecordsPanel
                        catId={catId}
                        vaccinations={profile.vaccinations ?? undefined}
                        alerts={flattenTier0Alerts(profile.alerts)}
                      />
                    )}
                    {t.key === "timeline" && <TimelinePanel catId={catId} alerts={flattenTier0Alerts(profile.alerts)} />}
                    {t.key === "charts" && <ChartsPanel catId={catId} />}
                    {t.key === "gallery" && <GalleryPanel catId={catId} />}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Lock className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {isAr ? "السجل الطبي خارج نطاق دورك" : "The clinical record isn't part of your role"}
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {actor.role
                  ? isAr
                    ? `بصفتك ${VET_ROLE_LABELS[actor.role].ar}، تشوف هوية القط وتنبيهاته الحرجة وتقدر تفتح زيارة — والتفاصيل الطبية مقصورة على الطاقم السريري. طبيب أو مدير العيادة يقدر يفتحها.`
                    : `As ${VET_ROLE_LABELS[actor.role].en}, you see the cat's identity, the critical alerts, and you can open a visit — the medical detail is reserved for clinical staff. A veterinarian or the clinic manager can open it.`
                  : isAr
                    ? "التفاصيل الطبية مقصورة على الطاقم السريري."
                    : "The medical detail is reserved for clinical staff."}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── hero ─────────────────────────────────────────────────────────────────

function Hero({
  profile,
  missing,
}: {
  profile: PatientProfile;
  missing: ReturnType<typeof deriveMissingVaccinations>;
}) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [revealPhone, setRevealPhone] = React.useState(false);

  const { membership, owner } = profile;
  const vaccines = vaccinationStandingLabel(
    vaccinationStanding(profile.vaccinations, missing),
    missing.length,
    isAr
  );
  const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive" | "outline"> = {
    ACTIVE: "success",
    PENDING: "warning",
    SUSPENDED: "destructive",
    EXPIRED: "outline",
    NONE: "outline",
  };

  const genderWord =
    profile.sex === "FEMALE"
      ? isAr
        ? "أنثى"
        : "Female"
      : profile.sex === "MALE"
        ? isAr
          ? "ذكر"
          : "Male"
        : isAr
          ? "غير محدد"
          : "Unknown";

  const facts = [
    (isAr ? profile.breedAr : profile.breedEn) ?? "",
    genderWord,
    // The server composes the age bilingually; fall back to the local
    // formatter only when it didn't send one.
    (isAr ? profile.ageLabel?.ar : profile.ageLabel?.en) ?? formatCatAge(profile.ageMonths, isAr) ?? "",
    profile.birthDate
      ? isAr
        ? `مواليد ${formatDate(profile.birthDate, locale)}`
        : `b. ${formatDate(profile.birthDate, locale)}`
      : "",
  ].filter(Boolean);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
        {/* The cat is the hero — literally the largest thing on the screen. */}
        <div className="flex items-center gap-3 sm:block">
          {profile.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photoUrl}
              alt=""
              className="size-20 shrink-0 rounded-2xl object-cover ring-1 ring-border sm:size-28"
            />
          ) : (
            <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground sm:size-28">
              <Cat className="size-9" aria-hidden />
            </span>
          )}
          <div className="sm:hidden">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{profile.name}</h1>
            <p className="font-mono text-xs tracking-wide text-muted-foreground">
              {profile.catIdNumber}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="hidden items-center gap-3 sm:flex">
            <h1 className="font-display text-3xl font-semibold tracking-tight">{profile.name}</h1>
            <span className="font-mono text-sm tracking-wide text-muted-foreground">
              {profile.catIdNumber}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* The words come from the server beside the status, so a state we
                don't have a colour for is still named correctly (R093). */}
            <Badge variant={statusVariant[membership.state] ?? "outline"}>
              <BadgeCheck className="size-3" aria-hidden />
              {(isAr ? membership.label?.ar : membership.label?.en) || membership.state}
            </Badge>
            {/* Safety never expires — worth saying out loud exactly when the
                membership doesn't stand, because that's when a clinic wonders. */}
            {membership.state !== "ACTIVE" && membership.careContinues && (
              <Badge variant="accent">{isAr ? "الرعاية مستمرة" : "Care continues"}</Badge>
            )}
            {typeof profile.weightKg === "number" && (
              <Badge variant="secondary">
                <Weight className="size-3" aria-hidden />
                <span className="font-mono tabular-nums">{profile.weightKg}</span>{" "}
                {isAr ? "كجم" : "kg"}
              </Badge>
            )}
            {profile.sterilised !== null && (
              <Badge variant="outline">
                {profile.sterilised
                  ? isAr
                    ? "معقّم"
                    : "Sterilised"
                  : isAr
                    ? "غير معقّم"
                    : "Not sterilised"}
              </Badge>
            )}
            {/* Four states, not two — "withheld" and "nothing on file" are
                both reported as themselves rather than as "current" (R040). */}
            <Badge variant={vaccines.variant}>
              <Syringe className="size-3" aria-hidden />
              {vaccines.text}
            </Badge>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">{facts.join(" · ")}</p>

          {profile.microchip && (
            <p className="mt-1 text-xs text-muted-foreground">
              {isAr ? "الشريحة" : "Microchip"}:{" "}
              <span className="font-mono tracking-wide">{profile.microchip}</span>
            </p>
          )}

          {/* Owner — the number stays masked until deliberately revealed, and
              revealing is an action the owner's access log can carry. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              {isAr ? "المالك" : "Owner"}:{" "}
              <span className="font-medium text-foreground">
                {/* Identity is tier 1. Below it the server sends null, and the
                    honest word is "withheld", not a blank space. */}
                {owner.firstName ?? (isAr ? "محجوب" : "Withheld")}
              </span>
            </span>
            {revealPhone && owner.phone ? (
              <a
                href={`tel:${owner.phone}`}
                dir="ltr"
                className="inline-flex min-h-[44px] items-center gap-1.5 font-mono text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Phone className="size-3.5" aria-hidden />
                {owner.phone}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span className="font-mono text-sm text-muted-foreground" dir="ltr">
                  {owner.maskedPhone}
                </span>
                {owner.phone && (
                  <button
                    type="button"
                    onClick={() => setRevealPhone(true)}
                    className="inline-flex min-h-[44px] items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Eye className="size-3.5" aria-hidden />
                    {isAr ? "أظهر الرقم" : "Reveal"}
                  </button>
                )}
              </span>
            )}
            {owner.emergencyContactName && (
              <span className="text-xs text-muted-foreground">
                {isAr ? "للطوارئ" : "Emergency"}: {owner.emergencyContactName}
                {owner.emergencyContactPhone ? ` · ${owner.emergencyContactPhone}` : ""}
              </span>
            )}
          </div>

          {/* How well this clinic knows this cat. */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span
              className={cn(
                "rounded-full px-2.5 py-1",
                profile.isOwnPatient
                  ? "bg-primary/10 font-medium text-primary"
                  : "border border-border"
              )}
            >
              {profile.isOwnPatient
                ? isAr
                  ? "من مرضى عيادتكم"
                  : "One of your patients"
                : isAr
                  ? "أول زيارة لعيادتكم"
                  : "New to your clinic"}
            </span>
            {profile.lastVisitAt && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden />
                {isAr ? "آخر زيارة" : "Last visit"}:{" "}
                <span className="font-medium text-foreground">
                  {formatDate(profile.lastVisitAt, locale)}
                </span>
              </span>
            )}
            {profile.visitCountHere > 0 && (
              <span>
                {isAr
                  ? `${profile.visitCountHere} زيارة عندكم`
                  : `${profile.visitCountHere} visit${profile.visitCountHere === 1 ? "" : "s"} here`}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── consent ──────────────────────────────────────────────────────────────

const TIER_COPY: Record<
  ConsentTier,
  { ar: string; en: string; whatAr: string; whatEn: string; hiddenAr: string[]; hiddenEn: string[] }
> = {
  T0: {
    ar: "المستوى ٠ — الهوية والتنبيهات",
    en: "Tier 0 — identity & alerts",
    whatAr: "تشوف من هي، وما الذي قد يؤذيها. لا سجل طبي.",
    whatEn: "You see who she is, and what could harm her. No medical record.",
    hiddenAr: ["ملخّص الرعاية", "التحصينات", "منحنى الوزن", "سجل العيادات الأخرى"],
    hiddenEn: ["Care summary", "Vaccinations", "Weight history", "Other clinics' records"],
  },
  T1: {
    ar: "المستوى ١ — ملخّص الرعاية",
    en: "Tier 1 — care summary",
    whatAr: "التحصينات والحالات المعروفة والأدوية الحالية ومنحنى الوزن.",
    whatEn: "Vaccinations, known conditions, current medications and the weight history.",
    hiddenAr: ["ملاحظات العيادات الأخرى", "تقارير المختبر والأشعة", "المستندات"],
    hiddenEn: ["Other clinics' notes", "Lab & imaging reports", "Documents"],
  },
  T2: {
    ar: "المستوى ٢ — السجل الكامل",
    en: "Tier 2 — full history",
    whatAr: "يشمل ملاحظات وتقارير العيادات الأخرى، بموافقة المالك.",
    whatEn: "Includes notes and reports from other clinics, with the owner's consent.",
    hiddenAr: [],
    hiddenEn: [],
  },
};

function ConsentBanner({ profile, catId }: { profile: PatientProfile; catId: string }) {
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const api = useVetApi();
  // Default to the MOST restrictive tier, never the most permissive: if we
  // cannot tell what this clinic is allowed to see, "identity and alerts only"
  // is the answer that cannot leak. (This lookup returning undefined is what
  // took the whole screen to the error boundary — `TIER_COPY[undefined]`.)
  const tier: ConsentTier = profile.consentTier ?? "T0";
  const nextTier: ConsentTier | null = tier === "T0" ? "T1" : tier === "T1" ? "T2" : null;
  const [requested, setRequested] = React.useState(false);

  const ask = useMutation({
    mutationFn: () => api.requestConsent({ catId, tier: nextTier!, scope: "STANDING" }),
    onSuccess: () => {
      setRequested(true);
      toast({
        variant: "success",
        title: isAr ? "وصل الطلب للمالك" : "The owner has been asked",
        description: isAr
          ? "يظهر لهم إشعار باسم عيادتكم. لا شيء ينفتح قبل موافقتهم."
          : "They get a notification naming your clinic. Nothing opens until they say yes.",
      });
    },
    onError: (err) => {
      const f = vetFriendlyError(err, isAr);
      toast({ variant: "error", title: f.title, description: f.message });
    },
  });

  const copy = TIER_COPY[tier] ?? TIER_COPY.T0;
  const hidden = isAr ? copy.hiddenAr : copy.hiddenEn;
  const full = tier === "T2";
  // The server names what it withheld, in its own bilingual words. Prefer that
  // over our static list wherever it speaks — it knows the actual grant.
  const serverReasons = Array.from(
    new Map(
      (profile.hiddenSections ?? []).map((h) => [h.reason?.code ?? h.section, h.reason])
    ).values()
  ).filter(Boolean);

  return (
    <Card
      className={cn(
        "p-4",
        full ? "border-success/30 bg-success/[0.04]" : "border-warning/35 bg-warning/[0.05]"
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            full ? "bg-success/15 text-success" : "bg-warning/20 text-[hsl(38_92%_26%)] dark:text-warning"
          )}
        >
          {full ? <Unlock className="size-4" /> : <Lock className="size-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">{isAr ? copy.ar : copy.en}</h2>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            {isAr ? copy.whatAr : copy.whatEn}
          </p>

          {/* The honest locked state — name what is withheld, never leave a
              blank panel that reads as "there is nothing here". */}
          {hidden.length > 0 && (
            <div className="mt-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
              <p className="text-xs font-semibold text-foreground">
                {isAr ? "محجوب عنكم الآن" : "Withheld from you right now"}
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {hidden.map((s) => (
                  <li
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    <Lock className="size-3" aria-hidden />
                    {s}
                  </li>
                ))}
              </ul>
              {serverReasons.length > 0 ? (
                serverReasons.map((r) => (
                  <p key={r.code} className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {isAr ? r.ar : r.en}
                  </p>
                ))
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {isAr
                    ? "المالك لم يمنح هذه العيادة الاطلاع على هذا الجزء بعد."
                    : "The owner hasn't granted this clinic access to that part yet."}
                </p>
              )}
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {isAr
                  ? "هذا الجزء موجود — لكنه غير مرئي لكم. ما تشوفونه هنا ليس السجل الكامل."
                  : "That content exists — it is simply not visible to you. What you see here is not the complete record."}
              </p>
            </div>
          )}

          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {isAr
              ? "ما تكتبه عيادتكم يبقى مرئياً لكم دائماً. كل اطلاع على المستوى ١ أو ٢ يُسجَّل ويقرأه المالك."
              : "What your clinic writes stays visible to your clinic forever. Every tier-1 and tier-2 view is logged and readable by the owner."}
          </p>
        </div>

        {nextTier && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            loading={ask.isPending}
            disabled={requested}
            onClick={() => ask.mutate()}
          >
            <Unlock className="size-4" />
            {requested
              ? isAr
                ? "بانتظار المالك"
                : "Waiting on the owner"
              : isAr
                ? "اطلب اطلاعاً من المالك"
                : "Request access from the owner"}
          </Button>
        )}
      </div>
    </Card>
  );
}

// ── quick actions ────────────────────────────────────────────────────────

const REASONS: { value: string; ar: string; en: string }[] = [
  { value: "VACCINATION", ar: "تحصين", en: "Vaccination" },
  { value: "ILLNESS", ar: "مرض", en: "Illness" },
  { value: "FOLLOW_UP", ar: "متابعة", en: "Follow-up" },
  { value: "GROOMING", ar: "عناية", en: "Grooming" },
  { value: "OTHER", ar: "أخرى", en: "Other" },
];

function QuickActions({ profile, catId }: { profile: PatientProfile; catId: string }) {
  const { locale } = useLocale();
  const { toast } = useToast();
  const router = useRouter();
  const isAr = locale === "ar";
  const actor = useVetActor();
  const api = useVetApi();

  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("VACCINATION");
  const [otherReason, setOtherReason] = React.useState("");
  const [error, setError] = React.useState("");

  const start = useMutation({
    mutationFn: () => {
      const picked = REASONS.find((r) => r.value === reason);
      return api.openVisit({
        catId,
        reason: reason === "OTHER" ? otherReason.trim() : (picked ? picked.en : reason),
        branchId: actor.branchId ?? undefined,
      });
    },
    onSuccess: (visit) => {
      setOpen(false);
      router.push(`/vet/visits/${visit.id}`);
    },
    onError: (err) => {
      const f = vetFriendlyError(err, isAr);
      setError(f.message);
      toast({ variant: "error", title: f.title, description: f.message });
    },
  });

  const canOpenVisit = actor.can("visit.open");
  const canEmergency = actor.can("emergency.access");
  if (!canOpenVisit && !canEmergency) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canOpenVisit && (
          <Button variant="brand" size="lg" onClick={() => setOpen(true)}>
            <CalendarDays className="size-4" />
            {isAr ? `افتح زيارة لـ${profile.name}` : `Start a visit for ${profile.name}`}
          </Button>
        )}
        {canEmergency && (
          <Link
            href={`/vet/emergency/${catId}`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2")}
          >
            <Siren className="size-4" aria-hidden />
            {isAr ? "وصول طارئ" : "Emergency access"}
          </Link>
        )}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isAr ? "افتح زيارة" : "Start a visit"}
        description={
          isAr
            ? "سبب واحد يكفي الآن — التفاصيل السريرية تُكتب داخل الزيارة."
            : "One reason is enough now — the clinical detail is written inside the visit."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={start.isPending}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="brand"
              loading={start.isPending}
              onClick={() => {
                if (reason === "OTHER" && otherReason.trim().length < 2) {
                  setError(isAr ? "اكتب السبب باختصار." : "Write the reason briefly.");
                  return;
                }
                setError("");
                start.mutate();
              }}
            >
              {isAr ? "افتح الزيارة" : "Open the visit"}
            </Button>
          </>
        }
      >
        <fieldset>
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isAr ? "سبب الزيارة" : "Reason"}
          </legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                aria-pressed={reason === r.value}
                onClick={() => setReason(r.value)}
                className={cn(
                  "min-h-[44px] rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  reason === r.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {isAr ? r.ar : r.en}
              </button>
            ))}
          </div>
        </fieldset>

        {reason === "OTHER" && (
          <div className="mt-3">
            <label htmlFor="visit-other-reason" className="block text-xs font-medium text-foreground">
              {isAr ? "اكتب السبب" : "Describe the reason"}
            </label>
            <Input
              id="visit-other-reason"
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              invalid={!!error && reason === "OTHER"}
              className="mt-1"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}

// ── skeleton ─────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-5" aria-hidden>
      <Card className="p-5">
        <div className="flex gap-4">
          <Skeleton className="size-28 rounded-2xl" />
          <div className="flex-1">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="mt-3 h-5 w-72" />
            <Skeleton className="mt-3 h-4 w-60" />
          </div>
        </div>
      </Card>
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-12 rounded-2xl" />
    </div>
  );
}
