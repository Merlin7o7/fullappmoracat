"use client";

// ════════════════════════════════════════════════════════════════════════
//  Care plans — two modes on one route, switched by commerceEnabled():
//
//  • Commerce OFF (Community Mode): the honest "later" page. No checkout,
//    no payment, no activation path — visitors see what a care plan will be,
//    a preview, and can ask to be told when plans open. Lexicon (R087): the
//    paid product is «خطة العناية»; the free Cat ID is never "inactive", and
//    partner rates appear only when PARTNERS is non-empty (R006/R040).
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
import { RENEWAL_SHORT } from "@moraqat/core";
import { type ApiPlan, type PlanTier } from "@/lib/plan-recommend";
import {
  recommendFromConsumption,
  type WetLevel,
  type DryLevel,
  type LitterLevel,
  type TreatsLevel,
} from "@/lib/consumption-recommend";
import { ProductIntro } from "@/components/product-intro";
import { QueryError } from "@/components/query-error";
import { LaunchDeliveryNote } from "@/components/launch-note";
import { IlloHeart, IlloPaw } from "@/components/illustrations";
import { formatSAR, formatSARMonthly } from "@moraqat/core";
import { PARTNERS } from "@/lib/partners";
import { friendlyError } from "@/lib/errors";

type Interest = "KITTEN" | "STARTER" | "STANDARD" | "PREMIUM" | "unsure";

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

  // The wizard: intro → questions → result. Nothing is preselected — the member
  // is introduced to the product, answers a few consumption questions, THEN sees
  // one honest recommendation they can still change (never an auto-picked tier).
  const [step, setStep] = React.useState<"intro" | "questions" | "result">("intro");
  const [wet, setWet] = React.useState<WetLevel | null>(null);
  const [dry, setDry] = React.useState<DryLevel | null>(null);
  const [litter, setLitter] = React.useState<LitterLevel | null>(null);
  const [treats, setTreats] = React.useState<TreatsLevel | null>(null);
  const answered = !!(wet && dry && litter && treats);
  const [rec, setRec] = React.useState<ReturnType<typeof recommendFromConsumption> | null>(null);

  // Never lose entered data (R117): the quiz survives a refresh. Answers + step
  // persist per cat in sessionStorage; the recommendation is recomputed, never
  // stored, so it always reflects the latest engine.
  const quizKey = `moraqat.planquiz.${catId ?? "household"}`;
  const restored = React.useRef(false);
  React.useEffect(() => {
    // Wait for the cats before restoring — the kitten rule reads birthdays.
    if (restored.current || typeof window === "undefined" || catsLoading) return;
    restored.current = true;
    try {
      const raw = window.sessionStorage.getItem(quizKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        step?: "intro" | "questions" | "result";
        wet?: WetLevel; dry?: DryLevel; litter?: LitterLevel; treats?: TreatsLevel;
      };
      if (saved.wet) setWet(saved.wet);
      if (saved.dry) setDry(saved.dry);
      if (saved.litter) setLitter(saved.litter);
      if (saved.treats) setTreats(saved.treats);
      const complete = !!(saved.wet && saved.dry && saved.litter && saved.treats);
      if (saved.step === "result" && complete) {
        setRec(recommendFromConsumption({ wet: saved.wet!, dry: saved.dry!, litter: saved.litter!, treats: saved.treats! }, targetCats));
        setStep("result");
      } else if (saved.step === "questions") {
        setStep("questions");
      }
    } catch {
      /* a broken saved quiz never blocks a fresh one */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizKey, catsLoading]);
  React.useEffect(() => {
    if (!restored.current || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(quizKey, JSON.stringify({ step, wet, dry, litter, treats }));
    } catch {
      /* storage full/blocked — the quiz still works, it just won't survive refresh */
    }
  }, [quizKey, step, wet, dry, litter, treats]);

  // Adjusting is allowed, never front-loaded (R005): the recommendation leads,
  // other tiers hide behind a quiet disclosure.
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const [chosenTier, setChosenTier] = React.useState<PlanTier | null>(null);
  const selectedTier = chosenTier ?? rec?.tier ?? null;
  const selectedPlan = plans?.find((p) => p.tier === selectedTier) ?? null;
  const isRecommendedSelected = !!rec && selectedTier === rec.tier;

  const goto = (s: "intro" | "questions" | "result") => {
    setStep(s);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };
  const submitAnswers = () => {
    if (!answered) return;
    setRec(recommendFromConsumption({ wet, dry, litter, treats }, targetCats));
    setChosenTier(null);
    goto("result");
  };

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
              ? "نفصّل خطة العناية على مقاس قطك — عرّفنا عليه أولاً ونلاقي له الأنسب"
              : "We tailor the box to your cat — introduce them first and we'll find their best fit"}
          </p>
          <Button onClick={() => router.push("/portal/cats")}>
            <Plus className="size-4" /> {isAr ? "أضف قطك" : "Add your cat"}
          </Button>
        </Card>
      </div>
    );
  }

  // ── Step 1 · Product introduction — subscription first, Cat ID a benefit ──
  if (step === "intro") {
    return (
      <ProductIntro
        isAr={isAr}
        catName={catLine}
        onStart={() => goto("questions")}
        onSkip={() => router.push("/portal")}
      />
    );
  }

  // ── Step 2 · Consumption questionnaire — nothing preselected ──────────────
  if (step === "questions") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <button
            type="button"
            onClick={() => goto("intro")}
            className="mb-3 inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Arrow className="size-4 rotate-180" aria-hidden /> {isAr ? "رجوع" : "Back"}
          </button>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {isAr ? `عن استهلاك ${catLine} الشهري` : `About ${catLine}'s monthly use`}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? "أربعة أسئلة سريعة — ونرشّح الخطة اللي تناسب استهلاككم فعلاً، بلا تخمين."
              : "Four quick questions — then we recommend the box that fits what you actually use, no guessing."}
          </p>
        </div>

        <Card className="space-y-5 p-6">
          <Segmented
            label={isAr ? "كم كيس/علبة طعام رطب تستخدمون شهرياً؟" : "How many wet food pouches/cans a month?"}
            value={wet ?? ""}
            options={[
              ["none", isAr ? "لا شيء" : "None"],
              ["few", isAr ? "قليل" : "A few"],
              ["regular", isAr ? "~15" : "~15"],
              ["lots", isAr ? "20+" : "20+"],
            ]}
            onChange={(v) => { setWet(v as WetLevel); setChosenTier(null); }}
          />
          <Segmented
            label={isAr ? "كم طعام جاف يأكل قطك شهرياً تقريباً؟" : "About how much dry food a month?"}
            value={dry ?? ""}
            options={[
              ["none", isAr ? "لا شيء" : "None"],
              ["one", isAr ? "~2كجم" : "~2kg"],
              ["two", isAr ? "4كجم+" : "4kg+"],
            ]}
            onChange={(v) => { setDry(v as DryLevel); setChosenTier(null); }}
          />
          <Segmented
            label={isAr ? "كم رمل تستخدمون شهرياً؟" : "How much cat litter a month?"}
            value={litter ?? ""}
            options={[
              ["none", isAr ? "لا شيء" : "None"],
              ["one", isAr ? "كيس" : "1 bag"],
              ["two", isAr ? "كيسين+" : "2+ bags"],
            ]}
            onChange={(v) => { setLitter(v as LitterLevel); setChosenTier(null); }}
          />
          <Segmented
            label={isAr ? "تشترون مكافآت بانتظام؟" : "Do you buy treats regularly?"}
            value={treats ?? ""}
            options={[
              ["rarely", isAr ? "نادراً" : "Rarely"],
              ["sometimes", isAr ? "أحياناً" : "Sometimes"],
              ["often", isAr ? "كثيراً" : "Often"],
            ]}
            onChange={(v) => { setTreats(v as TreatsLevel); setChosenTier(null); }}
          />
        </Card>

        <Button size="lg" className="w-full" disabled={!answered} onClick={submitAnswers}>
          {isAr ? `اعرض توصية ${catLine}` : `See ${catLine}'s recommendation`}
          <Arrow className="size-4" />
        </Button>
        {!answered && (
          <p className="text-center text-xs text-muted-foreground">
            {isAr ? "جاوب على الأسئلة الأربعة لنرشّح الأنسب" : "Answer all four to get your recommendation"}
          </p>
        )}
      </div>
    );
  }

  // ── Step 3 · The recommendation — computed from THEIR answers, not preset ──
  if (!rec || !selectedPlan) return null;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Result hero — "from your answers, here's the fit" (never auto-picked). */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 shadow-e1 sm:p-9">
        <IlloHeart
          tone="pink"
          className="pointer-events-none absolute -top-3 end-4 size-12 rotate-[12deg] opacity-40"
        />
        <button
          type="button"
          onClick={() => goto("questions")}
          className="mb-3 inline-flex min-h-9 items-center gap-1 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Arrow className="size-4 rotate-180" aria-hidden /> {isAr ? "عدّل إجاباتك" : "Edit your answers"}
        </button>
        <Badge variant="secondary" className="gap-1.5">
          <Sparkles className="size-3.5" />
          {isAr ? "توصيتنا لك" : "Our recommendation"}
        </Badge>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {isAr ? `خطة عناية ${catLine} — على مقاس استهلاككم` : `${catLine}'s care plan — sized to how you shop`}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {isAr
            ? "حسب إجاباتكم، هذي الخطة الأنسب — والقرار لكم، تقدرون تغيّرونها."
            : "From your answers, this is the best fit — and it's your call; you can still change it."}
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
                <span className="tabular">{formatSAR(selectedPlan.price, isAr ? "ar" : "en")}</span>
                <span className="ms-1.5 text-sm font-normal text-muted-foreground">
                  {isAr ? "/ شهرياً" : "/ month"}
                </span>
              </p>
              {/* The quiet money truth, BEFORE checkout ever shows a total (R021/R025)
                  — the one renewal wording from @moraqat/core. */}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isAr ? RENEWAL_SHORT.ar : RENEWAL_SHORT.en}
              </p>
              {/* No comparative price claim (R006): the July 2026 market sweep
                  did not support one, so we say what the plan does — never that
                  it costs less than buying the same things elsewhere. */}
              <p className="mt-1 text-xs text-muted-foreground">
                {isAr ? "يوصلك بابك كل شهر" : "Delivered to your door every month"}
              </p>
            </div>

            {/* Transparent reasons, straight from the member's own answers (R006). */}
            <div>
              <h2 className="mb-2 font-display text-sm font-semibold text-muted-foreground">
                {isAr ? "ليش هي الأنسب" : "Why it's the right fit"}
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
                              <span className="text-xs text-success">
                                {isAr ? "المحسوبة لهم" : "computed for them"}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                            {p.contents.map((c) => `${c.label} ${c.quantity}${c.unit}`).join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-end">
                          <span className="block font-display text-sm font-bold tabular">
                            {formatSAR(p.price, isAr ? "ar" : "en")}
                          </span>
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
                ? "توقّف أو ألغِ متى ما تبي — من صفحة خطة العناية، بضغطة"
                : "Pause or cancel anytime — one tap from your care plan page."}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

/** A compact segmented control for the interactive "personalize" panel. */
function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl bg-muted p-1">
        {options.map(([v, l]) => {
          const selected = value === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(v)}
              className={cn(
                "min-h-11 flex-1 rounded-lg px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "bg-card text-foreground shadow-e1" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Commerce OFF — Community Mode: "Care plans open later"
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
        title: isAr ? "سجّلناك في قائمة الانتظار" : "You're on the waitlist",
        variant: "success",
      });
    },
    onError: (e: unknown) => {
      const f = friendlyError(e, isAr);
      toast({ title: f.title, description: f.message, variant: "error" });
    },
  });

  // What a care plan WILL be — only things the plan itself will do. The Cat
  // ID is already fully working and free (never "activated" by paying), and
  // partner rates are listed only once a partner actually exists (R006/R040).
  const benefits = [
    {
      icon: Truck,
      titleAr: "توصيل شهري",
      titleEn: "Monthly delivery",
      bodyAr: "أكل ورمل قطك يوصلون بابك كل شهر — في الرياض وجدة أولاً.",
      bodyEn: "Your cat's food and litter at your door every month — Riyadh and Jeddah first.",
    },
    {
      icon: ShieldCheck,
      titleAr: "مبنية من ملف قطك",
      titleEn: "Built from your cat's profile",
      bodyAr: "نرشّح الخطة من عمر قطك ووزنه وعدد قطط البيت — والقرار لك.",
      bodyEn: "We suggest the plan from your cat's age, weight and household — the choice stays yours.",
    },
    ...(PARTNERS.length > 0
      ? [
          {
            // Member rates, not discounts — recognition, never coupon shouting (R085).
            icon: BadgeCheck,
            titleAr: "سعر الأعضاء",
            titleEn: "Member rates",
            bodyAr: "سعر الأعضاء عند شركائنا.",
            bodyEn: "Your member rate, honoured at our partners.",
          },
        ]
      : []),
    {
      icon: Stethoscope,
      titleAr: "هوية قطك تظل مجانية",
      titleEn: "The Cat ID stays free",
      bodyAr: "الهوية والسجل الصحي والمجتمع مجانية دايم — مع خطة أو بدونها.",
      bodyEn: "The ID, the health record and the community stay free — with or without a plan.",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-e1 sm:p-8">
        <Badge variant="secondary">{isAr ? "لاحقاً" : "Later"}</Badge>
        <h1 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
          {isAr ? "خطط العناية الشهرية تفتح لاحقاً" : "Monthly care plans open later"}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {isAr
            ? `هوية ${catLine || "قطك"} جاهزة ومجانية دايم. خطط العناية نجهّزها بعناية — نعلن موعدها هنا وبالإيميل لمن وافق.`
            : `${catLine || "Your cat"}'s ID is ready, and free for good. We're preparing care plans with care — we'll announce the date here, and by email to those who agreed.`}
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
              {isAr ? "لمحة عن خطط العناية" : "A preview of the care plans"}
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
                  <Badge variant="outline" className="text-xs">
                    {isAr ? "لاحقاً" : "Later"}
                  </Badge>
                </div>
                <p className="font-display text-xl font-bold tabular text-muted-foreground">
                  {formatSARMonthly(p.price, isAr ? "ar" : "en")}
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
                  ? " أول ما تفتح خطط العناية. ما يلزمك تسوي شي الحين."
                  : " as soon as care plans open. Nothing to do for now."}
              </p>
            </div>
          </Card>
        ) : (
          <Card className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <BellRing className="size-4 text-accent-foreground" />
              <h2 className="font-display text-lg font-semibold">
                {isAr ? "أبغى أعرف أول ما تفتح خطط العناية" : "Tell me when care plans open"}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {isAr
                ? "أي خطة تهمّك أكثر؟ (اختياري)"
                : "Which plan interests you most? (optional)"}
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["KITTEN", isAr ? "قطتي الصغيرة" : "Kitten"],
                  ["STARTER", isAr ? "الأساسيات" : "Essentials"],
                  ["STANDARD", isAr ? "العناية الكاملة" : "Complete"],
                  ["PREMIUM", isAr ? "التوقيع" : "Signature"],
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
                <Button variant="tertiary" size="sm" onClick={() => router.push("/portal")}>
                  {isAr ? "لاحقاً" : "Later"}
                </Button>
                <Button size="lg" disabled={join.isPending} onClick={() => join.mutate()}>
                  {join.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <BellRing className="size-4" />
                  )}
                  {isAr ? "بلّغوني بالإيميل" : "Email me"}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
