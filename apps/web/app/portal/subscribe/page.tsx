"use client";

// ════════════════════════════════════════════════════════════════════════
//  Membership — two modes on one route, switched by commerceEnabled():
//
//  • Commerce OFF (Community Mode): the launch-waitlist experience. No
//    checkout, no payment, no activation path — visitors see the benefits,
//    a premium preview, and can join the launch waitlist.
//  • Commerce ON: D2 — the Plan Builder. The plan is COMPUTED from the cat's
//    own profile via the shared feeding engine, never chosen from a tier
//    table (Design Authority amendment 2026-07-10). Adjusting is allowed,
//    never front-loaded (R005). One clear action → /portal/checkout.
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  Check,
  BellRing,
  ShieldCheck,
  Truck,
  Stethoscope,
  BadgeCheck,
  Loader2,
  Lock,
  ChevronDown,
  PauseCircle,
  ArrowLeft,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Card, Button, Badge, Skeleton, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { commerceEnabled } from "@/lib/features";
import { recommendPlan, type ApiPlan, type PlanTier } from "@/lib/plan-recommend";
import { QueryError } from "@/components/query-error";
import { LaunchDeliveryNote } from "@/components/launch-note";
import { IlloHeart, IlloPaw } from "@/components/illustrations";

type Interest = "STARTER" | "STANDARD" | "PREMIUM" | "unsure";

export default function SubscribePage() {
  return (
    <React.Suspense
      fallback={
        <div className="grid place-items-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      {commerceEnabled() ? <PlanBuilderInner /> : <ComingSoonInner />}
    </React.Suspense>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Commerce ON — D2: the Plan Builder
   ══════════════════════════════════════════════════════════════════════════ */

function PlanBuilderInner() {
  const router = useRouter();
  const params = useSearchParams();
  const catId = params.get("cat");
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const { activeCats, isLoading: catsLoading, isError: catsError, refetch: refetchCats, isFetching: catsFetching } = useCats();
  const isAr = locale === "ar";
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  const {
    data: plans,
    isLoading: plansLoading,
    isError: plansError,
    refetch: refetchPlans,
    isFetching: plansFetching,
  } = useQuery({
    queryKey: ["plans"],
    queryFn: () => authedFetch<ApiPlan[]>("/plans"),
    enabled: !!user,
  });

  const targetCats = React.useMemo(
    () => (catId ? activeCats.filter((c) => c.id === catId) : activeCats),
    [catId, activeCats]
  );
  const catLine = targetCats
    .map((c) => localizeName(c.name, isAr ? "ar" : "en"))
    .join(isAr ? "، " : ", ");

  // The computation — pure and transparent, from the same engine as /tools/feeding.
  const rec = React.useMemo(
    () => (plans && targetCats.length ? recommendPlan(targetCats, plans) : null),
    [plans, targetCats]
  );

  // Adjusting is allowed, never front-loaded (R005): the recommendation leads,
  // other tiers hide behind a quiet disclosure.
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const [chosenTier, setChosenTier] = React.useState<PlanTier | null>(null);
  const selectedTier = chosenTier ?? rec?.tier ?? null;
  const selectedPlan = plans?.find((p) => p.tier === selectedTier) ?? null;
  const isRecommendedSelected = !!rec && selectedTier === rec.tier;

  if (catsLoading || plansLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }
  if (catsError) {
    return <div className="mx-auto max-w-3xl"><QueryError isAr={isAr} onRetry={() => refetchCats()} retrying={catsFetching} /></div>;
  }
  if (plansError) {
    return <div className="mx-auto max-w-3xl"><QueryError isAr={isAr} onRetry={() => refetchPlans()} retrying={plansFetching} /></div>;
  }

  // No active cats yet — a welcome, not a void (R111). The plan is computed
  // from the cat, so the cat comes first.
  if (targetCats.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="relative flex flex-col items-center gap-4 overflow-hidden p-10 text-center">
          <IlloPaw tone="peach" className="pointer-events-none absolute start-8 top-6 size-7 rotate-[-14deg] opacity-50" />
          <IlloPaw tone="butter" className="size-20" />
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? "خطتك تُحسب من ملف قطك — عرّفنا عليه أولاً وبعدها نحسبها له بالضبط"
              : "Your plan is computed from your cat's profile — introduce them first and we'll size it exactly"}
          </p>
          <Button onClick={() => router.push("/portal/cats")}>
            <Plus className="size-4" /> {isAr ? "أضف قطك" : "Add your cat"}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Hero: the cat is the hero, the math serves them (R009) ─────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/[0.10] via-background to-primary/[0.06] p-7 shadow-e2 sm:p-9">
        <IlloHeart
          tone="pink"
          className="pointer-events-none absolute -top-3 end-4 size-12 rotate-[12deg] opacity-40"
        />
        <Badge variant="secondary" className="gap-1.5">
          <Sparkles className="size-3.5" />
          {isAr ? "عضوية" : "Membership"}
        </Badge>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {isAr
            ? `خطة ${catLine} — محسوبة ${targetCats.length > 1 ? "عليهم" : "عليه"} بالضبط`
            : `${catLine}'s plan — computed exactly for them`}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {isAr
            ? "ما نعرض عليك جدول باقات — نحسب احتياجهم الشهري من ملفهم، ونوريك كيف حسبناه."
            : "No tier table to decode — we compute the monthly need from their own profile, and show our working."}
        </p>
      </section>

      {/* ── The recommendation card ─────────────────────────────────────────── */}
      {selectedPlan && rec && (
        <Card className="overflow-hidden">
          <div className="space-y-5 p-6 sm:p-7">
            {/* Recommendation headline — "we'd recommend X for [cat], and why" (R005). */}
            {isRecommendedSelected && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge variant="success" className="gap-1">
                  <BadgeCheck className="size-3" />
                  {isAr ? `نرشّحها لـ ${catLine}` : `We'd recommend for ${catLine}`}
                </Badge>
                <span className="text-sm font-semibold text-accent-foreground">
                  {isAr ? rec.headline.ar : rec.headline.en}
                </span>
              </div>
            )}
            <div>
              <p className="font-display text-2xl font-bold">
                {isAr ? selectedPlan.nameAr : selectedPlan.nameEn}
              </p>
              <p className="mt-1.5 font-display text-2xl font-bold">
                <span className="tabular" dir="ltr">{selectedPlan.price} SAR</span>
                <span className="ms-1.5 text-sm font-normal text-muted-foreground">
                  {isAr ? "/ شهرياً" : "/ month"}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isAr
                  ? `تُدفع لكل مدة ${selectedPlan.minTermMonths ?? 3} أشهر — ${selectedPlan.price * (selectedPlan.minTermMonths ?? 3)} ر.س مقدّماً`
                  : `Billed per ${selectedPlan.minTermMonths ?? 3}-month term — ${selectedPlan.price * (selectedPlan.minTermMonths ?? 3)} SAR upfront`}
              </p>
            </div>

            {/* Transparent reasons, straight from the engine rationale (R006). */}
            <div>
              <h2 className="mb-2 font-display text-sm font-semibold text-muted-foreground">
                {isAr ? "كيف حسبناها" : "How we computed it"}
              </h2>
              <ul className="space-y-1.5">
                {rec.reasons.map((r) => (
                  <li key={r.en} className="flex items-start gap-2 text-sm leading-relaxed">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    <span>{isAr ? r.ar : r.en}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What arrives in the box. */}
            <div>
              <h2 className="mb-2 font-display text-sm font-semibold text-muted-foreground">
                {isAr ? "وش يوصلك كل شهر" : "What arrives every month"}
              </h2>
              <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                {selectedPlan.contents.map((c) => (
                  <li key={c.label} className="flex items-baseline gap-1.5">
                    <span aria-hidden>•</span>
                    <span>
                      {c.label}{" "}
                      <span className="tabular" dir="ltr">{c.quantity}{c.unit}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quiet disclosure — adjusting allowed, never front-loaded (R005). */}
            <div>
              <button
                type="button"
                onClick={() => setAdjustOpen((v) => !v)}
                aria-expanded={adjustOpen}
                className="flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", adjustOpen && "rotate-180")} aria-hidden />
                {isAr ? "قارن كل الباقات" : "Compare all plans"}
              </button>
              {adjustOpen && plans && (
                <div role="radiogroup" aria-label={isAr ? "الباقات" : "Plans"} className="mt-2 space-y-2">
                  {plans.map((p) => {
                    const selected = p.tier === selectedTier;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setChosenTier(p.tier)}
                        className={cn(
                          "flex w-full min-h-11 items-center justify-between gap-3 rounded-xl border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected
                            ? "border-primary bg-primary/[0.06]"
                            : "border-border hover:bg-muted/50"
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
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-medium">{isAr ? p.nameAr : p.nameEn}</span>
                            {rec && p.tier === rec.tier && (
                              <span className="text-[11px] text-success">
                                {isAr ? "المحسوبة لهم" : "computed for them"}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                            {p.contents.map((c) => `${c.label} ${c.quantity}${c.unit}`).join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 font-display text-sm font-bold tabular" dir="ltr">
                          {p.price} <span className="text-xs font-normal">SAR</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* One clear action (R005) + freedom before any card details (R023). */}
          <div className="space-y-3 border-t border-border bg-muted/30 p-6 sm:p-7">
            {/* Founding-member first-delivery date, before payment (no surprises). */}
            <LaunchDeliveryNote isAr={isAr} />
            <Button
              size="lg"
              className="w-full"
              onClick={() =>
                router.push(`/portal/checkout?plan=${selectedTier}${catId ? `&cat=${catId}` : ""}`)
              }
            >
              {isAr ? "أكمل إلى الدفع" : "Continue to checkout"}
              <Arrow className="size-4" />
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <PauseCircle className="size-3.5 shrink-0" aria-hidden />
              {isAr
                ? "توقّف أو ألغِ متى ما تبي — من صفحة اشتراكك، بضغطة"
                : "Pause or cancel anytime — one tap from your subscription page."}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Commerce OFF — Community Mode: "Memberships are launching soon"
   ══════════════════════════════════════════════════════════════════════════ */

function ComingSoonInner() {
  const router = useRouter();
  const params = useSearchParams();
  const catId = params.get("cat");
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const { activeCats } = useCats();
  const isAr = locale === "ar";

  const [interest, setInterest] = React.useState<Interest>("unsure");
  const [joined, setJoined] = React.useState(false);

  // Live plan catalogue powers an honest premium *preview* — never purchasable.
  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => authedFetch<ApiPlan[]>("/plans"),
    enabled: !!user,
  });

  const targetCats = React.useMemo(
    () => (catId ? activeCats.filter((c) => c.id === catId) : activeCats),
    [catId, activeCats]
  );
  const catLine = targetCats
    .map((c) => localizeName(c.name, isAr ? "ar" : "en"))
    .join(isAr ? "، " : ", ");

  const join = useMutation({
    mutationFn: () =>
      authedFetch("/waitlist", {
        method: "POST",
        body: JSON.stringify({
          email: user?.email,
          catName: targetCats[0]?.name,
          planInterest: interest,
          source: "portal-subscribe",
          locale,
        }),
      }),
    onSuccess: () => {
      setJoined(true);
      toast({
        title: isAr ? "سجّلناك في قائمة الإطلاق 🎉" : "You're on the launch list 🎉",
        variant: "success",
      });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "error" }),
  });

  const benefits = [
    {
      // Member rates, not discounts — recognition, never coupon shouting (R085).
      icon: BadgeCheck,
      titleAr: "أسعار الأعضاء",
      titleEn: "Member rates",
      bodyAr: "سعر الأعضاء عند شركائنا المؤسسين.",
      bodyEn: "Your member rate, honoured at our founding partners.",
    },
    {
      icon: Stethoscope,
      titleAr: "مزايا العيادات",
      titleEn: "Vet perks",
      bodyAr: "سعر الأعضاء في العيادات والفحوصات لدى شركائنا.",
      bodyEn: "Your member rate at partner clinics and check-ups.",
    },
    {
      icon: Truck,
      titleAr: "توصيل منسّق",
      titleEn: "Curated deliveries",
      bodyAr: "صناديق مختارة لقطك تصل في الوقت — بدون تفكير.",
      bodyEn: "Hand-picked boxes for your cat, delivered on time — effortless.",
    },
    {
      icon: ShieldCheck,
      titleAr: "هوية مفعّلة",
      titleEn: "Active Cat ID",
      bodyAr: "هوية قطك تصبح مفعّلة مع مزايا وامتيازات الأعضاء.",
      bodyEn: "Your Cat ID becomes active with full member benefits.",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/[0.10] via-background to-primary/[0.06] p-7 shadow-e2 sm:p-9">
        <IlloHeart
          tone="pink"
          className="pointer-events-none absolute -top-3 end-4 size-12 rotate-[12deg] opacity-40"
        />
        <Badge variant="secondary" className="gap-1.5">
          <Sparkles className="size-3.5" />
          {isAr ? "قريباً" : "Coming soon"}
        </Badge>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {isAr ? "العضويات على وشك الإطلاق" : "Memberships are launching soon"}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {isAr
            ? `هوية ${catLine || "قطك"} صدرت وجاهزة. نحن نجهّز العضويات بعناية — وفّرنا لك مكانك في قائمة الإطلاق لتكون أول من يعرف.`
            : `${catLine || "Your cat"}'s ID is issued and ready. We're crafting memberships with care — save your spot and be the first to know.`}
        </p>
      </section>

      {/* ── Benefits ─────────────────────────────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2">
        {benefits.map((b) => (
          <Card key={b.titleEn} className="flex gap-3 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent-foreground">
              <b.icon className="size-5" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold">{isAr ? b.titleAr : b.titleEn}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {isAr ? b.bodyAr : b.bodyEn}
              </p>
            </div>
          </Card>
        ))}
      </section>

      {/* ── Premium preview (not purchasable) ────────────────────────────── */}
      {plans && plans.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Lock className="size-3.5 text-muted-foreground" />
            <h2 className="font-display text-sm font-semibold text-muted-foreground">
              {isAr ? "لمحة عن الباقات عند الإطلاق" : "A preview of plans at launch"}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((p) => (
              <div
                key={p.id}
                aria-disabled
                className="relative rounded-2xl border border-border/70 bg-muted/30 p-4 opacity-90"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-display font-semibold">{isAr ? p.nameAr : p.nameEn}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {isAr ? "قريباً" : "Soon"}
                  </Badge>
                </div>
                <p className="font-display text-xl font-bold tabular text-muted-foreground" dir="ltr">
                  {p.price}
                  <span className="text-xs font-normal"> SAR/mo</span>
                </p>
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {p.contents.slice(0, 4).map((c) => (
                    <li key={c.label}>
                      • {c.label}{" "}
                      <span className="tabular" dir="ltr">
                        {c.quantity}
                        {c.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Waitlist ─────────────────────────────────────────────────────── */}
      <section>
        {joined ? (
          <Card className="flex items-center gap-4 border-primary/30 bg-primary/[0.06] p-6">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <Check className="size-6" />
            </span>
            <div>
              <p className="font-display text-lg font-semibold">
                {isAr ? "أنت في القائمة" : "You're on the list"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isAr ? "سنراسلك على " : "We'll email "}
                <span dir="ltr" className="font-medium text-foreground">
                  {user?.email}
                </span>
                {isAr
                  ? " لحظة فتح العضويات. لا حاجة لأي إجراء الآن."
                  : " the moment memberships open. Nothing to do for now."}
              </p>
            </div>
          </Card>
        ) : (
          <Card className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <BellRing className="size-4 text-accent-foreground" />
              <h2 className="font-display text-lg font-semibold">
                {isAr ? "أخبرني عند الإطلاق" : "Notify me at launch"}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {isAr
                ? "أي باقة تهمّك أكثر؟ (اختياري)"
                : "Which plan interests you most? (optional)"}
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["STARTER", isAr ? "المبتدئة" : "Starter"],
                  ["STANDARD", isAr ? "القياسية" : "Standard"],
                  ["PREMIUM", isAr ? "المميّزة" : "Premium"],
                  ["unsure", isAr ? "لست متأكد" : "Not sure yet"],
                ] as [Interest, string][]
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setInterest(v)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    interest === v
                      ? "border-primary bg-primary/10 font-medium text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                {isAr ? "سنراسلك على " : "We'll email "}
                <span dir="ltr" className="font-medium text-foreground">
                  {user?.email}
                </span>
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => router.push("/portal")}>
                  {isAr ? "لاحقاً" : "Later"}
                </Button>
                <Button size="lg" disabled={join.isPending} onClick={() => join.mutate()}>
                  {join.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <BellRing className="size-4" />
                  )}
                  {isAr ? "أخبرني عند الإطلاق" : "Notify me"}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
