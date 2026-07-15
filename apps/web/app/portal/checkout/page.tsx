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
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Check,
  CheckCircle2,
  MapPin,
  Plus,
  CreditCard,
  Smartphone,
  Wallet,
  CalendarClock,
  Star,
  BellRing,
  Mail,
} from "lucide-react";
import { Card, Button, Badge, Skeleton, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { commerceEnabled } from "@/lib/features";
import { formatDate } from "@/lib/datetime";
import { type ApiPlan, type PlanTier } from "@/lib/plan-recommend";
import { AddressForm, useCities, type SavedAddress } from "@/components/address-form";
import { QueryError } from "@/components/query-error";
import { IlloPaw } from "@/components/illustrations";

const TIERS: PlanTier[] = ["STARTER", "STANDARD", "PREMIUM"];

/** Committed term options (months). Minimum 3 — members pay price × term upfront. */
const TERM_OPTIONS = [3, 6, 12] as const;

/** KSA-first payment order — mada & Apple Pay lead, then STC Pay, then cards. */
const PAYMENT_METHODS = [
  { key: "MADA", labelAr: "مدى", labelEn: "mada", hintAr: "بطاقتك البنكية السعودية", hintEn: "Your Saudi bank card", icon: CreditCard },
  { key: "APPLE_PAY", labelAr: "Apple Pay", labelEn: "Apple Pay", hintAr: "بلمسة من جهازك", hintEn: "One touch from your device", icon: Wallet },
  { key: "STC_PAY", labelAr: "STC Pay", labelEn: "STC Pay", hintAr: "من محفظتك الرقمية", hintEn: "From your digital wallet", icon: Smartphone },
  { key: "VISA", labelAr: "فيزا", labelEn: "Visa", hintAr: "", hintEn: "", icon: CreditCard },
  { key: "MASTERCARD", labelAr: "ماستركارد", labelEn: "Mastercard", hintAr: "", hintEn: "", icon: CreditCard },
  { key: "TABBY", labelAr: "تابي", labelEn: "Tabby", hintAr: "ادفع على دفعات", hintEn: "Pay in instalments", icon: CalendarClock },
  { key: "TAMARA", labelAr: "تمارا", labelEn: "Tamara", hintAr: "ادفع على دفعات", hintEn: "Pay in instalments", icon: CalendarClock },
] as const;

type ProviderKey = (typeof PAYMENT_METHODS)[number]["key"];

interface ActivateResponse {
  subscriptionId: string;
  status: string;
  orderNumber: string;
  grandTotal: number;
  taxTotal: number;
  currency: string;
  nextBillingAt: string | null;
  redirectUrl: string | null;
  payment: { provider: string; status: string };
  plan: { tier: PlanTier; nameEn: string; nameAr: string };
  cats: { id: string; name: string }[];
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
  const [provider, setProvider] = React.useState<ProviderKey>("MADA");
  const [done, setDone] = React.useState<ActivateResponse | null>(null);

  const targetCats = React.useMemo(
    () => (catId ? activeCats.filter((c) => c.id === catId) : activeCats),
    [catId, activeCats]
  );
  const catLine = targetCats
    .map((c) => localizeName(c.name, uiLocale))
    .join(isAr ? "، " : ", ");

  // Renewal falls at the end of the committed term (whole term prepaid).
  const renewalDate = React.useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + termMonths);
    return formatDate(d, uiLocale, { day: "numeric", month: "long", year: "numeric" });
  }, [termMonths, uiLocale]);

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
        }),
      }),
    onSuccess: (res) => {
      // PSP redirect flows: the member finishes payment on the provider's page.
      if (res.redirectUrl) {
        window.location.assign(res.redirectUrl);
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
            {isAr
              ? `باقة «${done.plan.nameAr}» — أول صندوق في طريقه إليكم.`
              : `The ${done.plan.nameEn} plan — the first box is on its way.`}
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
                    ? `التجديد الأول في ${formatDate(done.nextBillingAt, uiLocale, { day: "numeric", month: "long", year: "numeric" })} — ونذكّرك قبله.`
                    : `First renewal on ${formatDate(done.nextBillingAt, uiLocale, { day: "numeric", month: "long", year: "numeric" })} — we'll remind you before it.`}
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
    <div className="mx-auto max-w-2xl space-y-6">
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
              {isAr ? "/ شهرياً، شامل الضريبة" : "/ month, VAT included"}
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
                  error={createAddress.error?.message}
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
        <div role="radiogroup" aria-label={isAr ? "مدة الاشتراك" : "Subscription length"} className="grid grid-cols-3 gap-2">
          {TERM_OPTIONS.filter((t) => t >= minTerm).map((t) => {
            const selected = t === termMonths;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTermMonths(t)}
                className={cn(
                  "min-h-11 rounded-xl border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected ? "border-primary bg-primary/[0.06]" : "border-border hover:bg-muted/50"
                )}
              >
                <span className="block font-display text-lg font-bold tabular" dir="ltr">{t}</span>
                <span className="block text-xs text-muted-foreground">{isAr ? "أشهر" : "months"}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {isAr
            ? `الحد الأدنى ${minTerm} أشهر — تدفع كامل المدة مقدّماً، والتوصيل شهري.`
            : `Minimum ${minTerm} months — you pay the full term upfront, delivered monthly.`}
        </p>
      </Card>

      {/* ── 4 · Payment ──────────────────────────────────────────────────── */}
      <Card className="space-y-5 p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <CreditCard className="size-4 text-primary" aria-hidden />
          {isAr ? "الدفع" : "Payment"}
        </h2>

        <div role="radiogroup" aria-label={isAr ? "وسيلة الدفع" : "Payment method"} className="space-y-2">
          {PAYMENT_METHODS.map((m) => {
            const selected = m.key === provider;
            const hint = isAr ? m.hintAr : m.hintEn;
            return (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setProvider(m.key)}
                className={cn(
                  "flex w-full min-h-11 items-center gap-3 rounded-xl border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected ? "border-primary bg-primary/[0.06]" : "border-border hover:bg-muted/50"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-full border",
                    selected ? "border-primary" : "border-muted-foreground/40"
                  )}
                >
                  {selected && <span className="size-2 rounded-full bg-primary" />}
                </span>
                <m.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1 text-sm font-medium">{isAr ? m.labelAr : m.labelEn}</span>
                {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
              </button>
            );
          })}
        </div>

        {/* The commitment line (R021): the exact upfront total + the reminder (R025).
            0% VAT while not VAT-registered. */}
        <div className="space-y-1.5 rounded-xl bg-muted/50 p-4 text-center">
          <p className="text-sm font-medium">
            {isAr ? (
              <>
                <span className="tabular" dir="ltr">{plan.price}</span> ر.س × {termMonths} أشهر ={" "}
                <span className="tabular font-bold" dir="ltr">{plan.price * termMonths}</span> ر.س تُدفع الآن
              </>
            ) : (
              <>
                <span className="tabular" dir="ltr">{plan.price}</span> SAR × {termMonths} months ={" "}
                <span className="tabular font-bold" dir="ltr">{plan.price * termMonths}</span> SAR paid now
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? `توصيل شهري طوال ${termMonths} أشهر — التجديد في ${renewalDate}`
              : `Monthly delivery for ${termMonths} months — renews ${renewalDate}`}
          </p>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <BellRing className="size-3.5 shrink-0" aria-hidden />
            {isAr ? "نذكّرك قبل التجديد" : "We remind you before renewal"}
          </p>
        </div>

        {/* Dignified retry — say what happened + the way forward, never blame (R118/R113). */}
        {activate.isError && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/[0.06] p-4 text-sm">
            <p className="font-medium">
              {isAr ? "ما اكتملت عملية الدفع — وما انخصم منك شيء" : "The payment didn't go through — nothing was charged"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {activate.error instanceof Error && activate.error.message
                ? activate.error.message
                : isAr
                  ? "جرّب مرة ثانية، أو اختر وسيلة دفع أخرى."
                  : "Try again, or pick another payment method."}
            </p>
          </div>
        )}

        <Button size="lg" className="w-full" disabled={!canPay} onClick={() => activate.mutate()}>
          {activate.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {isAr ? "جارٍ التفعيل…" : "Activating…"}
            </>
          ) : (
            <>{isAr ? `فعّل عضوية ${catLine}` : `Activate ${catLine}'s membership`}</>
          )}
        </Button>
        {!addressId && !addrLoading && (
          <p className="text-center text-xs text-muted-foreground">
            {isAr ? "اختر عنوان التوصيل أولاً وبعدها فعّل" : "Pick a delivery address first, then activate"}
          </p>
        )}
      </Card>
    </div>
  );
}
