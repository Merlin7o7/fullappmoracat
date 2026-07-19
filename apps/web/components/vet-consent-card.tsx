"use client";

/**
 * Vet consent — the shared vocabulary of the veterinary surfaces.
 *
 * This module is the single home of the consent copy (R006 honest by default,
 * R010 dignity, R106 PDPL). Every surface that names a tier — the health-access
 * page, the cat drawer, the dashboard, the admin partner console — reads it
 * from here so the promise made to an owner never drifts between screens.
 * The partner-status vocabulary lives here for the same reason, and because
 * Next.js page files may export only their default component.
 *
 * The thesis: privacy is a visible ledger, not a promise. So the copy explains
 * exactly what a clinic sees in each tier, and — just as loudly — what it does
 * NOT see, plus the T0 floor the owner cannot switch off. We say that plainly
 * rather than let someone discover it later; a surprise is the trust-killer.
 */

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ArrowRight, Stethoscope, Siren } from "lucide-react";
import { Card, Badge, Skeleton, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";

/** Owner-grantable tiers. T0 (identity + medical alerts) is always on — never granted. */
export type VetTier = "T1" | "T2";

export interface ConsentGrant {
  id: string;
  orgId: string;
  orgNameEn: string;
  orgNameAr: string;
  tier: VetTier;
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  /** A break-glass grant the clinic opened in an emergency — disclosed, never hidden. */
  emergency: boolean;
  reason: string | null;
}

export interface ConsentResponse {
  grants: ConsentGrant[];
}

/**
 * The owner-consent endpoints, in one place.
 *
 * The API is the contract of record and serves these under `/vet/owner/consent/
 * grants`, returning `{ items }` with the clinic nested as `{ id, ar, en }`.
 * These screens were written against a flatter shape, so rather than let the
 * two drift (a 404 that surfaces to a member as "something went wrong"), the
 * paths and the adapter live here and every caller goes through them.
 */
export const CONSENT_ENDPOINTS = {
  list: (catId: string) => `/vet/owner/consent/grants?catId=${encodeURIComponent(catId)}`,
  create: "/vet/owner/consent/grants",
  revoke: (grantId: string) => `/vet/owner/consent/grants/${encodeURIComponent(grantId)}/revoke`,
} as const;

/** The API's grant row, as actually returned. */
interface ApiConsentGrant {
  id: string;
  tier: VetTier;
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  emergency: boolean;
  reason: string | null;
  clinic?: { id: string; ar: string; en: string; logoUrl?: string | null } | null;
}

/** Map the API's `{ items, clinic:{…} }` onto the flat shape these screens read. */
export function toConsentResponse(raw: unknown): ConsentResponse {
  const rows =
    (raw as { items?: ApiConsentGrant[]; grants?: ApiConsentGrant[] } | null)?.items ??
    (raw as { grants?: ApiConsentGrant[] } | null)?.grants ??
    [];
  return {
    grants: rows.map((g) => ({
      id: g.id,
      orgId: g.clinic?.id ?? "",
      orgNameEn: g.clinic?.en ?? "",
      orgNameAr: g.clinic?.ar ?? "",
      tier: g.tier,
      grantedAt: g.grantedAt,
      expiresAt: g.expiresAt ?? null,
      revokedAt: g.revokedAt ?? null,
      emergency: !!g.emergency,
      reason: g.reason ?? null,
    })),
  };
}

export interface AccessLogItem {
  id: string;
  orgNameEn: string;
  orgNameAr: string;
  staffName?: string | null;
  tier: string;
  surface: string;
  emergency: boolean;
  at: string;
}

export interface AccessLogResponse {
  items: AccessLogItem[];
  pagination: { page: number; total: number; totalPages: number };
}

/** A grant still in force: not revoked, and not past its expiry. */
export function isGrantLive(g: ConsentGrant, now: number = Date.now()): boolean {
  if (g.revokedAt) return false;
  if (g.expiresAt && new Date(g.expiresAt).getTime() <= now) return false;
  return true;
}

/**
 * The clinic's name in the reader's language, falling back to the other
 * language rather than rendering an empty string — a nameless clinic on a
 * consent screen is worse than one named in the wrong language.
 * Accepts either shape the API uses (`orgName*` on grants, `name*` on
 * directory entries) so no call site has to remap first.
 */
export function orgName(
  g: { orgNameEn?: string | null; orgNameAr?: string | null; nameEn?: string | null; nameAr?: string | null },
  isAr: boolean
): string {
  const ar = g.orgNameAr ?? g.nameAr ?? "";
  const en = g.orgNameEn ?? g.nameEn ?? "";
  return (isAr ? ar : en) || en || ar;
}

interface TierCopy {
  /** Short name for chips and table cells. */
  label: { ar: string; en: string };
  /** One plain sentence — what this tier is, in an owner's words. */
  oneLine: { ar: string; en: string };
  /** What the clinic can open. Written as things, not data fields. */
  includes: { ar: string; en: string }[];
  /** What it deliberately does NOT reach — stated as loudly as what it does. */
  excludes: { ar: string; en: string }[];
}

/**
 * The tier catalogue. `{cat}` is substituted with the cat's name at render time
 * (R082 — the cat's name belongs in the copy, and consent is easier to judge
 * when it's about Mishmish rather than "the subject").
 */
export const TIER_COPY: Record<VetTier, TierCopy> = {
  T1: {
    label: { ar: "ملخص العناية", en: "Care summary" },
    oneLine: {
      ar: "ما تحتاجه العيادة لتعتني بـ{cat} بأمان في زيارة عادية.",
      en: "What a clinic needs to look after {cat} safely in an ordinary visit.",
    },
    includes: [
      { ar: "التطعيمات وتواريخ الجرعات القادمة", en: "Vaccinations, and when the next ones are due" },
      { ar: "الحالات الصحية السابقة والحالية", en: "Past and current health conditions" },
      { ar: "الأدوية التي يأخذها {cat} حالياً", en: "Medicines {cat} is taking right now" },
      { ar: "سجل الوزن وتغيّره مع الوقت", en: "Weight history and how it has changed" },
      { ar: "هل {cat} معقّم، ووجود تأمين من عدمه", en: "Whether {cat} is sterilised, and if there's insurance" },
    ],
    excludes: [
      { ar: "ملاحظات الأطباء في العيادات الأخرى", en: "Visit notes written by other clinics" },
      { ar: "التحاليل والأشعة والملفات المرفوعة", en: "Lab results, X-rays and uploaded files" },
    ],
  },
  T2: {
    label: { ar: "السجل الكامل", en: "Full history" },
    oneLine: {
      ar: "كل ملف {cat} الطبي، بما فيه ما كتبته العيادات الأخرى.",
      en: "{cat}'s complete medical file, including what other clinics have written.",
    },
    includes: [
      { ar: "كل ما في «ملخص العناية»", en: "Everything in the care summary" },
      { ar: "ملاحظات الأطباء من كل عيادة زارها {cat}", en: "Vets' notes from every clinic {cat} has visited" },
      { ar: "نتائج التحاليل وتقارير المختبر", en: "Lab results and test reports" },
      { ar: "الأشعة والصور التشخيصية", en: "X-rays and diagnostic imaging" },
      { ar: "الوصفات الطبية والمستندات المرفوعة", en: "Prescriptions and uploaded documents" },
    ],
    excludes: [
      { ar: "بيانات الدفع وطرق السداد", en: "Your payment details and cards" },
      { ar: "عنوانك ومعلومات حسابك في مرقط", en: "Your address and Moracat account details" },
    ],
  },
};

/** Fill `{cat}` in tier copy. Falls back to a warm generic when the name is missing. */
function withCat(s: string, catName: string | undefined, isAr: boolean): string {
  return s.replace(/\{cat\}/g, catName || (isAr ? "قطك" : "your cat"));
}

export function tierLabel(tier: string, isAr: boolean): string {
  const copy = TIER_COPY[tier as VetTier];
  if (!copy) return tier;
  return isAr ? copy.label.ar : copy.label.en;
}

/**
 * The full plain-language explanation of one tier: what it opens, what it
 * doesn't. Used in the grant flow (before consent) and on each live grant
 * (after) — the same words in both places, so nothing reads like fine print.
 */
export function TierExplainer({
  tier,
  catName,
  isAr,
  className,
}: {
  tier: VetTier;
  catName?: string;
  isAr: boolean;
  className?: string;
}) {
  const copy = TIER_COPY[tier];
  const t = (s: string) => withCat(s, catName, isAr);

  return (
    <div className={cn("space-y-3 text-sm", className)}>
      <p className="text-muted-foreground">{t(isAr ? copy.oneLine.ar : copy.oneLine.en)}</p>

      <div>
        <p className="mb-1.5 font-medium">{isAr ? "ما تستطيع العيادة فتحه:" : "What the clinic can open:"}</p>
        <ul className="space-y-1">
          {copy.includes.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-muted-foreground">
              {/* A shape, not a colour, carries the meaning (R093). */}
              <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{t(isAr ? item.ar : item.en)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-1.5 font-medium">{isAr ? "ما لا تصل إليه:" : "What it does not reach:"}</p>
        <ul className="space-y-1">
          {copy.excludes.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-muted-foreground">
              <span aria-hidden className="mt-[7px] h-px w-2.5 shrink-0 bg-muted-foreground/60" />
              <span>{t(isAr ? item.ar : item.en)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * The T0 floor, said out loud. A verified clinic always sees identity and
 * medical alerts — the owner cannot switch that off, and we explain *why*
 * rather than bury it. Hiding an allergy behind a permission could kill a cat;
 * that's a trade we make openly, in the owner's words (R006).
 */
export function AlwaysVisibleNote({
  catName,
  isAr,
  className,
}: {
  catName?: string;
  isAr: boolean;
  className?: string;
}) {
  const cat = catName || (isAr ? "قطك" : "your cat");
  return (
    <div className={cn("rounded-2xl border border-border bg-muted/40 p-4", className)}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-background text-muted-foreground">
          <Stethoscope className="size-4" />
        </span>
        <div className="space-y-1.5 text-sm">
          <p className="font-medium">{isAr ? "ما تراه كل عيادة موثّقة دائماً" : "What every verified clinic always sees"}</p>
          <p className="leading-relaxed text-muted-foreground">
            {isAr
              ? `صورة ${cat} واسمه وسلالته وعمره ووزنه وحالة العضوية، واسمك الأول ورقم جوال مُخفى جزئياً — مع تنبيهات ${cat} الطبية مثل الحساسية.`
              : `${cat}'s photo, name, breed, age, weight and membership status, your first name and a partly-hidden phone number — along with ${cat}'s medical alerts, like allergies.`}
          </p>
          <p className="leading-relaxed text-muted-foreground">
            {isAr
              ? `هذا الجزء لا يمكن إيقافه، وهذا مقصود: حساسية مخفية قد تكلّف ${cat} حياته. كل ما عدا ذلك يبقى بإذنك أنت.`
              : `This part can't be switched off, and that's deliberate: a hidden allergy could cost ${cat} their life. Everything beyond it stays under your permission.`}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Partner lifecycle status → bilingual label + Badge variant.
 * Word *and* colour carry the meaning, never colour alone (R093).
 */
export function partnerStatusMeta(status: string): {
  variant: "success" | "destructive" | "warning" | "secondary" | "info";
  en: string;
  ar: string;
} {
  switch (status) {
    case "PENDING":
    case "SUBMITTED":
      return { variant: "warning", en: "Pending review", ar: "بانتظار المراجعة" };
    case "IN_REVIEW":
      return { variant: "info", en: "In review", ar: "قيد المراجعة" };
    case "APPROVED":
      return { variant: "success", en: "Approved", ar: "مقبول" };
    case "REJECTED":
      return { variant: "destructive", en: "Rejected", ar: "مرفوض" };
    case "VERIFIED":
    case "ACTIVE":
      return { variant: "success", en: "Active", ar: "نشط" };
    case "SUSPENDED":
      return { variant: "destructive", en: "Suspended", ar: "موقوف" };
    case "UNVERIFIED":
      return { variant: "secondary", en: "Unverified", ar: "غير موثّق" };
    default:
      // Unknown status: show it plainly rather than guess a friendly name.
      return {
        variant: "secondary",
        en: status.split("_").map((w) => w[0] + w.slice(1).toLowerCase()).join(" "),
        ar: status,
      };
  }
}

/** A tier chip — colour plus the word, never colour alone (R093). */
export function TierBadge({ tier, isAr }: { tier: string; isAr: boolean }) {
  const known = tier === "T1" || tier === "T2";
  return (
    <Badge variant={tier === "T2" ? "warning" : "info"}>
      {known ? tierLabel(tier, isAr) : tier}
    </Badge>
  );
}

/** An emergency (break-glass) marker — always disclosed, with its reason nearby. */
export function EmergencyBadge({ isAr }: { isAr: boolean }) {
  return (
    <Badge variant="destructive" className="gap-1">
      <Siren aria-hidden className="size-3" />
      {isAr ? "فتح طارئ" : "Emergency access"}
    </Badge>
  );
}

/**
 * Compact consent summary for embedding in the dashboard or the cat drawer:
 * how many clinics can currently open this cat's record, and a way through to
 * the full ledger. Value stays visible without the owner going looking (R048).
 */
export function VetConsentCard({
  catId,
  catName,
  className,
  isAr,
}: {
  catId: string;
  catName?: string;
  className?: string;
  isAr: boolean;
}) {
  const { authedFetch, user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["vet-consent", user?.id, catId],
    queryFn: async () => toConsentResponse(await authedFetch<unknown>(CONSENT_ENDPOINTS.list(catId))),
    enabled: !!user && !!catId,
  });

  const live = React.useMemo(() => (data?.grants ?? []).filter((g) => isGrantLive(g)), [data]);
  const emergencyCount = live.filter((g) => g.emergency).length;
  const cat = catName || (isAr ? "قطك" : "your cat");

  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold">{isAr ? "من يرى سجل قطك" : "Who can see the record"}</h3>

          {isLoading ? (
            <Skeleton className="mt-2 h-4 w-48" />
          ) : isError ? (
            // Honest, not alarming: we don't know, so we don't guess a number.
            <p className="mt-1 text-sm text-muted-foreground">
              {isAr ? "تعذّر تحميل قائمة الأذونات الآن." : "We couldn't load the permissions just now."}
            </p>
          ) : live.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {isAr
                ? `لا توجد عيادة لديها إذن بفتح سجل ${cat} الطبي.`
                : `No clinic has permission to open ${cat}'s medical record.`}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {isAr
                ? `${live.length === 1 ? "عيادة واحدة" : `${live.length.toLocaleString("ar-SA")} عيادات`} لديها إذن بفتح سجل ${cat}.`
                : `${live.length} clinic${live.length === 1 ? "" : "s"} can open ${cat}'s record.`}
            </p>
          )}

          {emergencyCount > 0 && (
            <p className="mt-2">
              <EmergencyBadge isAr={isAr} />
            </p>
          )}

          <Link
            href="/portal/health-access"
            className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {isAr ? "إدارة الأذونات وسجل الاطلاع" : "Manage access & see the ledger"}
            <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </Card>
  );
}
