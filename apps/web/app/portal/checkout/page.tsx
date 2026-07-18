"use client";

// ════════════════════════════════════════════════════════════════════════
//  D3 — Checkout: one calm scrolling page, three sections.
//
//  1. Plan summary   — what the membership is (from /plans + ?plan=).
//  2. Delivery       — a saved address, or add one inline. Kingdom-wide.
//  3. Payment        — mada & Apple Pay first-class (R026/R105), then the
//                      commitment line (R021), the reminder promise (R025),
//                      and a pay button that names the action (R086).
//
//  Trust precedes the ask (R004): the pause/cancel freedom was shown on the
//  Plan Builder BEFORE this page; the full price + cycle + first-renewal
//  date sit immediately above the button. No preselected upsells, no
//  urgency, nothing hidden (R006). Unreachable when commerce is off.
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Check,
  CheckCircle2,
  MapPin,
  Plus,
  CreditCard,
  CalendarClock,
  Star,
  BellRing,
  Mail,
  PauseCircle,
  HeartHandshake,
} from "lucide-react";
import { Card, Button, Badge, Skeleton, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { commerceEnabled } from "@/lib/features";
import { monthsLabel, monthUnit } from "@/lib/datetime";
import { formatSAR, formatMoneyDate } from "@/lib/money";
import { friendlyError } from "@/lib/errors";
import { ApiError } from "@/lib/http";
import { type ApiPlan, type PlanTier } from "@/lib/plan-recommend";
import { AddressForm, useCities, type SavedAddress } from "@/components/address-form";
import { BoxBuilder, type BoxSelections } from "@/components/box-builder";
import { QueryError } from "@/components/query-error";
import { LaunchDeliveryNote } from "@/components/launch-note";
import { IlloPaw } from "@/components/illustrations";

const TIERS: PlanTier[] = ["STARTER", "STANDARD", "PREMIUM"];

/** Committed term options (months). 1 is the low-commitment entry point; 3 is
 *  the recommended default. Members pay price × term upfront. */
const TERM_OPTIONS = [1, 3, 6, 12] as const;

// Tamara is the only payment method (customers choose full vs. instalments on
// Tamara's page). No in-app method selector.

interface ActivateResponse {
  subscriptionId: string;
  status: string;
  orderNumber?: string;
  grandTotal?: number;
  taxTotal?: number;
  currency?: string;
  nextBillingAt?: string | null;
  redirectUrl: string | null;
  /** True when an abandoned DRAFT was picked back up instead of re-charged. */
  resumed?: boolean;
  payment?: { provider: string; status: string };
  plan?: { tier: PlanTier; nameEn: string; nameAr: string };
  cats?: { id: string; name: string }[];
}

/** Month-end-clamped month arithmetic — mirrors the API's addMonths exactly
 *  (Jan 31 + 1mo = Feb 28/29, never a silent roll into March — R021). */
function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

/** KITTEN < 12 months, SENIOR ≥ 10 years — same thresholds as @moraqat/core. */
function lifeStageFromBirth(birthDate: string | null | undefined): "KITTEN" | "ADULT" | "SENIOR" | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  const months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (months < 12) return "KITTEN";
  if (months >= 120) return "SENIOR";
  return "ADULT";
}

export default function CheckoutPage() {
  return (
    <React.Suspense
      fallback={
        <div className="grid place-items-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CheckoutInner />
    </React.Suspense>
  );
}

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const planParam = params.get("plan");
  const catId = params.get("cat");
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const uiLocale = locale === "ar" ? ("ar" as const) : ("en" as const);
  const { activeCats, isLoading: catsLoading } = useCats();
  const qc = useQueryClient();
  const isAr = locale === "ar";

  // Commerce-facing surface must be unreachable in Community Mode.
  const commerceOn = commerceEnabled();
  React.useEffect(() => {
    if (!commerceOn) router.replace("/portal/subscribe");
  }, [commerceOn, router]);

  const validTier = planParam && (TIERS as string[]).includes(planParam);

  const { data: plans, isLoading: plansLoading, isError: plansError, refetch: refetchPlans, isFetching: plansFetching } = useQuery({
    queryKey: ["plans"],
    queryFn: () => authedFetch<ApiPlan[]>("/plans"),
    enabled: !!user && commerceOn,
  });

  const plan = React.useMemo(
    () => (validTier && plans ? plans.find((p) => p.tier === planParam) ?? null : null),
    [validTier, plans, planParam]
  );

  // Guard: a missing/invalid plan means the member skipped the Plan Builder —
  // send them back to the computation, never guess a tier for them.
  React.useEffect(() => {
    if (!commerceOn) return;
    if (!validTier || (plans && !plan)) router.replace("/portal/subscribe");
  }, [commerceOn, validTier, plans, plan, router]);

  // ── Delivery ──────────────────────────────────────────────────────────────
  const { data: addresses, isLoading: addrLoading, isError: addrError, refetch: refetchAddr, isFetching: addrFetching } = useQuery({
    queryKey: ["addresses", user?.id],
    queryFn: () => authedFetch<SavedAddress[]>("/addresses"),
    enabled: !!user && commerceOn,
  });
  const [addressId, setAddressId] = React.useState<string | null>(null);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const citiesQ = useCities();

  // Default to the member's default address the moment addresses arrive.
  React.useEffect(() => {
    if (!addresses || addressId) return;
    const preferred = addresses.find((a) => a.isDefault) ?? addresses[0];
    if (preferred) setAddressId(preferred.id);
    else setShowAddForm(true); // no saved addresses — open the form as a welcome
  }, [addresses, addressId]);

  const createAddress = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      authedFetch<SavedAddress>("/addresses", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: ["addresses"] });
      if (created?.id) setAddressId(created.id);
      setShowAddForm(false);
    },
  });

  // ── Term commitment (min 3 months, paid upfront) + Payment ──────────────────
  const minTerm = plan?.minTermMonths ?? 3;
  const [termMonths, setTermMonths] = React.useState<number>(3);
  React.useEffect(() => {
    if (termMonths < minTerm) setTermMonths(minTerm);
  }, [minTerm, termMonths]);
  // Tamara is the only payment method. The customer chooses full vs. instalments
  // on Tamara's own page, so there's no method selector here.
  const provider = "TAMARA" as const;
  const [done, setDone] = React.useState<ActivateResponse | null>(null);
  // Per-line brand/flavor picks from the box builder (contentId → productId).
  // Pre-filled with our recommendations; the member may change any of them.
  const [boxSelections, setBoxSelections] = React.useState<BoxSelections>({});

  const targetCats = React.useMemo(
    () => (catId ? activeCats.filter((c) => c.id === catId) : activeCats),
    [catId, activeCats]
  );
  const catLine = targetCats
    .map((c) => localizeName(c.name, uiLocale))
    .join(isAr ? "، " : ", ");

  // The term simply ENDS at this date — nothing renews on it. Clamped exactly
  // like the API so the preview never disagrees with the invoice (R021).
  const termEndDate = React.useMemo(
    () => formatMoneyDate(addMonthsClamped(new Date(), termMonths), isAr),
    [termMonths, isAr]
  );

  const activate = useMutation({
    mutationFn: () =>
      authedFetch<ActivateResponse>("/subscriptions/activate", {
        method: "POST",
        body: JSON.stringify({
          planId: plan!.id,
          catIds: targetCats.map((c) => c.id),
          addressId,
          provider,
          termMonths,
          selections: Object.entries(boxSelections).map(([contentId, productId]) => ({
            contentId,
            productId,
          })),
        }),
      }),
    onSuccess: (res) => {
      // PSP redirect flows: the member finishes payment on the provider's page.
      // A resumed DRAFT hands back the SAME session — never a duplicate charge.
      if (res.redirectUrl) {
        window.location.assign(res.redirectUrl);
        return;
      }
      if (res.resumed) {
        // An in-flight membership exists but its checkout URL is gone — the
        // subscriptions page owns completing it (resume-payment / fresh link).
        router.push("/portal/subscriptions");
        return;
      }
      void qc.invalidateQueries({ queryKey: ["cats"] });
      void qc.invalidateQueries({ queryKey: ["subscriptions"] });
      void qc.invalidateQueries({ queryKey: ["overview"] });
      setDone(res);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    },
  });

  if (!commerceOn) return null;

  // ── Success — confirm what went live + the receipt promise (R024) ────────
  if (done) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="relative overflow-hidden p-8 text-center sm:p-10">
          <IlloPaw tone="sage" className="pointer-events-none absolute start-8 top-6 size-7 rotate-[-14deg] opacity-50" />
          <IlloPaw tone="peach" className="pointer-events-none absolute bottom-6 end-10 size-7 rotate-[18deg] opacity-60" />
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="size-8" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {isAr ? `عضوية ${catLine} صارت مفعّلة 🎉` : `${catLine}'s membership is now active 🎉`}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {done.plan
              ? isAr
                ? `باقة «${done.plan.nameAr}» — أول صندوق في طريقه إليكم.`
                : `The ${done.plan.nameEn} plan — the first box is on its way.`
              : isAr
                ? "أول صندوق في طريقه إليكم."
                : "The first box is on its way."}
          </p>
          <div className="mx-auto mt-5 max-w-sm space-y-2 text-start text-sm">
            <p className="flex items-start gap-2 text-muted-foreground">
              <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {isAr ? "الإيصال في طريقه إلى " : "Your receipt is on its way to "}
                <span dir="ltr" className="font-medium text-foreground">{user?.email}</span>
              </span>
            </p>
            {done.nextBillingAt && (
              <p className="flex items-start gap-2 text-muted-foreground">
                <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {isAr
                    ? `مدتكم مدفوعة حتى ${formatMoneyDate(done.nextBillingAt, true)} — بدون أي تجديد تلقائي؛ ندعوك قبل نهايتها.`
                    : `Your term is paid through ${formatMoneyDate(done.nextBillingAt, false)} — no automatic renewal; we'll invite you before it ends.`}
                </span>
              </p>
            )}
          </div>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={() => router.push("/portal")}>
              {isAr ? "إلى بوابتك" : "Go to your portal"}
            </Button>
            <Button variant="outline" size="lg" onClick={() => router.push("/portal/subscriptions")}>
              {isAr ? "إدارة اشتراكك" : "Manage your subscription"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (plansLoading || catsLoading || !plan) {
    if (plansError) {
      return <div className="mx-auto max-w-2xl"><QueryError isAr={isAr} onRetry={() => refetchPlans()} retrying={plansFetching} /></div>;
    }
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const canPay = !!addressId && targetCats.length > 0 && !activate.isPending;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 sm:pb-0">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {isAr ? `تفعيل عضوية ${catLine}` : `Activate ${catLine}'s membership`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAr ? "خطوة أخيرة وتصير العضوية مفعّلة" : "One last step and the membership goes live"}
        </p>
      </div>

      {/* ── 1 · Plan summary ─────────────────────────────────────────────── */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{isAr ? "الباقة" : "Plan"}</p>
            <p className="font-display text-lg font-bold">{isAr ? plan.nameAr : plan.nameEn}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isAr ? `لـ ${catLine}` : `For ${catLine}`}
            </p>
          </div>
          <p className="font-display text-xl font-bold">
            <span className="tabular" dir="ltr">{plan.price} SAR</span>
            <span className="ms-1 text-xs font-normal text-muted-foreground">
              {isAr ? "/ شهرياً" : "/ month"}
            </span>
          </p>
        </div>
        <ul className="mt-4 grid gap-1 border-t border-border pt-4 text-sm text-muted-foreground sm:grid-cols-2">
          {plan.contents.map((c) => (
            <li key={c.label} className="flex items-baseline gap-1.5">
              <Check className="size-3.5 translate-y-0.5 text-success" aria-hidden />
              <span>
                {c.label} <span className="tabular" dir="ltr">{c.quantity}{c.unit}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* ── 1.5 · Build your box — pick brand & flavor per line (flat price).
             Facets arrive pre-answered from the cat's own profile (R001). ─── */}
      <BoxBuilder
        planId={plan.id}
        isAr={isAr}
        onChange={setBoxSelections}
        catLifeStage={lifeStageFromBirth(targetCats[0]?.birthDate)}
        catSterilized={targetCats[0]?.isNeutered ?? null}
      />

      {/* ── 2 · Delivery — kingdom-wide, no city gating ──────────────────── */}
      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <MapPin className="size-4 text-primary" aria-hidden />
            {isAr ? "التوصيل" : "Delivery"}
          </h2>
          {!showAddForm && (
            <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)} disabled={citiesQ.isLoading}>
              {citiesQ.isLoading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {isAr ? "عنوان جديد" : "New address"}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {isAr ? "نوصّل لكل مدن المملكة" : "We deliver kingdom-wide"}
        </p>

        {addrLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : addrError ? (
          <QueryError isAr={isAr} onRetry={() => refetchAddr()} retrying={addrFetching} />
        ) : (
          <>
            {addresses && addresses.length > 0 && (
              <div role="radiogroup" aria-label={isAr ? "عناوين التوصيل" : "Delivery addresses"} className="space-y-2">
                {addresses.map((a) => {
                  const selected = a.id === addressId;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setAddressId(a.id)}
                      className={cn(
                        "flex w-full min-h-11 items-start gap-3 rounded-xl border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "border-primary bg-primary/[0.06]" : "border-border hover:bg-muted/50"
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1 grid size-4 shrink-0 place-items-center rounded-full border",
                          selected ? "border-primary" : "border-muted-foreground/40"
                        )}
                      >
                        {selected && <span className="size-2 rounded-full bg-primary" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {a.label || a.recipient}
                          {a.isDefault && (
                            <Badge variant="success" className="gap-1 text-[10px]">
                              <Star className="size-2.5" /> {isAr ? "افتراضي" : "Default"}
                            </Badge>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                          {a.recipient} · {a.phone}
                          <br />
                          {a.street}
                          {a.district ? `, ${a.district}` : ""} — {isAr ? a.city.nameAr : a.city.nameEn}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {showAddForm &&
              (citiesQ.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : citiesQ.isError ? (
                <QueryError
                  isAr={isAr}
                  onRetry={() => citiesQ.refetch()}
                  retrying={citiesQ.isFetching}
                  title={isAr ? "تعذّر تحميل قائمة المدن — أعد المحاولة لإضافة عنوان" : "We couldn't load the city list — try again to add an address"}
                />
              ) : citiesQ.data && citiesQ.data.length > 0 ? (
                <AddressForm
                  isAr={isAr}
                  cities={citiesQ.data}
                  pending={createAddress.isPending}
                  error={createAddress.error ? friendlyError(createAddress.error, isAr).message : undefined}
                  onClose={() => setShowAddForm(false)}
                  onSubmit={(b) => createAddress.mutate(b)}
                  className="border-dashed"
                />
              ) : null)}
          </>
        )}
      </Card>

      {/* ── 3 · Term commitment (min 3 months, paid upfront) ─────────────── */}
      <Card className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <CalendarClock className="size-4 text-primary" aria-hidden />
          {isAr ? "مدة الاشتراك" : "Subscription length"}
        </h2>
        <div role="radiogroup" aria-label={isAr ? "مدة الاشتراك" : "Subscription length"} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {/* No fabricated "Best value" — every term costs exactly price × months.
              The only honest label is flexibility on the shortest term (R006/R025). */}
          {TERM_OPTIONS.filter((t) => t >= minTerm).map((t) => {
            const selected = t === termMonths;
            const flexible = t === 1;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTermMonths(t)}
                className={cn(
                  "relative min-h-11 rounded-xl border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected ? "border-primary bg-primary/[0.06]" : "border-border hover:bg-muted/50"
                )}
              >
                {flexible && (
                  <span className="absolute -top-2 start-1/2 -translate-x-1/2 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold text-secondary-foreground rtl:translate-x-1/2">
                    {isAr ? "الأكثر مرونة" : "Most flexible"}
                  </span>
                )}
                <span className="block font-display text-lg font-bold tabular" dir="ltr">{t}</span>
                <span className="block text-xs text-muted-foreground">{monthUnit(t, uiLocale)}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {isAr
            ? `ابدأ بـ ${monthsLabel(minTerm, "ar")} أو التزم أطول — تدفع كامل المدة مقدّماً، والتوصيل شهري.`
            : `Start with ${monthsLabel(minTerm, "en")} or commit longer — you pay the full term upfront, delivered monthly.`}
        </p>
      </Card>

      {/* ── 4 · Payment — Tamara only, positioned as choice not just financing ── */}
      <Card className="space-y-5 p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <CreditCard className="size-4 text-primary" aria-hidden />
          {isAr ? "الدفع" : "Payment"}
        </h2>

        <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
          <span className="grid h-10 shrink-0 place-items-center rounded-lg bg-primary px-2.5 text-sm font-bold lowercase tracking-tight text-primary-foreground">
            tamara
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{isAr ? "الدفع الآمن عبر تمارا" : "Pay securely through Tamara"}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {isAr
                ? "ادفع كامل المبلغ اليوم، أو قسّمه على دفعات ميسّرة — تختار الطريقة في صفحة تمارا (حسب الموافقة والأهلية)."
                : "Pay in full today, or split into convenient instalments — you choose on Tamara's secure page (subject to approval & eligibility)."}
            </p>
          </div>
        </div>

        {/* Founding-member launch note — first delivery date, shown before payment. */}
        <LaunchDeliveryNote isAr={isAr} />

        {/* The commitment block (R021): the exact upfront total, when it ends,
            and the honest promise — no automatic renewal, ever (R025). */}
        <div className="space-y-1.5 rounded-xl bg-muted/50 p-4 text-center">
          <p className="text-sm font-medium">
            {isAr ? (
              <>
                <span dir="ltr" className="tabular">{formatSAR(plan.price, true)}</span> × {monthsLabel(termMonths, "ar")} ={" "}
                <span dir="ltr" className="tabular font-bold">{formatSAR(plan.price * termMonths, true)}</span> تُدفع اليوم
              </>
            ) : (
              <>
                <span dir="ltr" className="tabular">{formatSAR(plan.price, false)}</span> × {monthsLabel(termMonths, "en")} ={" "}
                <span dir="ltr" className="tabular font-bold">{formatSAR(plan.price * termMonths, false)}</span> paid today
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? `توصيل شهري حتى ${termEndDate}`
              : `Delivered monthly until ${termEndDate}`}
          </p>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <BellRing className="size-3.5 shrink-0" aria-hidden />
            <span>
              {isAr ? (
                <><strong className="font-semibold text-foreground">بدون أي تجديد تلقائي — أبداً</strong>؛ ندعوك قبل نهاية مدتك.</>
              ) : (
                <><strong className="font-semibold text-foreground">No automatic renewal — ever</strong>; we invite you before your term ends.</>
              )}
            </span>
          </p>
        </div>

        {/* Failures branch on the structured code, never raw prose (R084/R113). */}
        {activate.isError && (() => {
          const fe = friendlyError(activate.error, isAr);
          // A cat that's already covered is a fact, not a failure — a calm card
          // pointing home, never the red payment frame.
          if (fe.code === "CAT_ALREADY_COVERED") {
            return (
              <div role="status" className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
                <HeartHandshake className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium">{fe.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{fe.message}</p>
                  <Link
                    href="/portal/subscriptions"
                    className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {isAr ? "إلى اشتراكاتك" : "Go to your subscriptions"}
                  </Link>
                </div>
              </div>
            );
          }
          // A true payment decline (402) — and ONLY that — earns the reassurance
          // that nothing was charged (R118). Validation problems get their own
          // calm, specific copy without inventing a charge that never started.
          const isPaymentFailure =
            activate.error instanceof ApiError && activate.error.status === 402;
          return (
            <div
              role="alert"
              className={cn(
                "rounded-xl border p-4 text-sm",
                isPaymentFailure ? "border-destructive/30 bg-destructive/[0.06]" : "border-border bg-muted/40"
              )}
            >
              <p className="font-medium">
                {isPaymentFailure
                  ? isAr
                    ? "ما اكتملت عملية الدفع — وما انخصم منك شيء"
                    : "The payment didn't go through — nothing was charged"
                  : fe.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {isPaymentFailure
                  ? isAr
                    ? "جرّب مرة ثانية متى ما كنت جاهزاً — هوية قطك بأمان."
                    : "Try again whenever you're ready — your cat's ID is safe."
                  : fe.message}
              </p>
            </div>
          );
        })()}

        <Button size="lg" className="w-full" disabled={!canPay} loading={activate.isPending} onClick={() => activate.mutate()}>
          {activate.isPending
            ? isAr ? "نحوّلك إلى تمارا…" : "Taking you to Tamara…"
            : isAr ? "المتابعة إلى الدفع عبر تمارا" : "Continue to payment with Tamara"}
        </Button>
        {!addressId && !addrLoading && (
          <p className="text-center text-xs text-muted-foreground">
            {isAr ? "اختر عنوان التوصيل أولاً وبعدها فعّل" : "Pick a delivery address first, then activate"}
          </p>
        )}

        {/* Freedom stays visible right where the money is asked for (R023). */}
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <PauseCircle className="size-3.5 shrink-0" aria-hidden />
          {isAr
            ? "توقّف مؤقتاً أو ألغِ متى ما تبي — من صفحة اشتراكك، بضغطة"
            : "Pause or cancel anytime — one tap from your subscription page"}
        </p>
      </Card>

      {/* ── Sticky mobile bar — the exact total + the action survive scrolling
             (R021/R100: the commitment stays visible in the thumb zone). ───── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0">
            <p className="font-display text-base font-bold leading-tight">
              <span dir="ltr" className="tabular">{formatSAR(plan.price * termMonths, isAr)}</span>
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {isAr ? `${monthsLabel(termMonths, "ar")} — بدون تجديد تلقائي` : `${monthsLabel(termMonths, "en")} — no auto-renewal`}
            </p>
          </div>
          <Button
            size="lg"
            className="ms-auto flex-1"
            disabled={!canPay}
            loading={activate.isPending}
            onClick={() => activate.mutate()}
          >
            {activate.isPending
              ? isAr ? "نحوّلك…" : "One moment…"
              : isAr ? "ادفع عبر تمارا" : "Pay with Tamara"}
          </Button>
        </div>
      </div>
    </div>
  );
}
