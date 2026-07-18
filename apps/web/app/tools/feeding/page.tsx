"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Droplets, Package, Sparkles, Cat as CatIcon, Wallet, Minus, Plus, ArrowRight } from "lucide-react";
import { calculateFeeding, type FeedingInput } from "@moraqat/core";
import { Card, Button, cn } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IlloCan, IlloFish, IlloPaw, Sticker } from "@/components/illustrations";
import { useLocale } from "@/app/providers";
import { useAuth } from "@/lib/auth";
import { localizeName } from "@/lib/translit";
import { formatAmount, SAR_AR, SAR_EN } from "@/lib/money";

type Activity = "LOW" | "MODERATE" | "HIGH";
type Body = "UNDERWEIGHT" | "IDEAL" | "OVERWEIGHT";

const L = {
  ar: {
    title: "محرك التغذية الذكي",
    subtitle: "احسب الكمية المثالية لقطك وفق الإرشادات البيطرية — فوراً.",
    weight: "الوزن (كجم)",
    age: "العمر (أشهر)",
    activity: "مستوى النشاط",
    activityOpts: { LOW: "منخفض", MODERATE: "متوسط", HIGH: "عالٍ" },
    body: "الحالة الجسدية",
    bodyOpts: { UNDERWEIGHT: "نحيف", IDEAL: "مثالي", OVERWEIGHT: "زائد" },
    indoor: "قط منزلي",
    neutered: "مُعقّم",
    dryShare: "نسبة الطعام الجاف",
    cats: "عدد القطط",
    decrease: "أنقص",
    increase: "زد",
    results: "توصيتك الشهرية",
    daily: "سعرات يومية",
    dry: "طعام جاف",
    wet: "أكياس رطبة",
    litter: "رمل",
    treats: "مكافآت",
    suppl: "مكملات",
    cost: "التكلفة التقديرية",
    perMonth: "/ شهرياً",
    confidence: "مستوى الثقة",
    kgMo: "كجم/شهر",
    pouchesMo: "كيس/شهر",
    packsMo: "علبة/شهر",
    unitsMo: "وحدة/شهر",
    kcal: "سعرة",
    sar: SAR_AR,
    bridgeTitle: "خطة مُرقّط تغطي هذا",
    bridgeBody: "أكل ورمل ومكافآت على مقاس قطك، توصل بابك شهرياً — ننقل وزنه وعمره معك، فما تعيد إدخال شيء.",
    bridgeCta: (name: string | null) => (name ? `ابنِ خطة ${name}` : "ابنِ خطة قطك"),
  },
  en: {
    title: "Smart Feeding Engine",
    subtitle: "Calculate the ideal amount for your cat using veterinary guidelines — instantly.",
    weight: "Weight (kg)",
    age: "Age (months)",
    activity: "Activity level",
    activityOpts: { LOW: "Low", MODERATE: "Moderate", HIGH: "High" },
    body: "Body condition",
    bodyOpts: { UNDERWEIGHT: "Under", IDEAL: "Ideal", OVERWEIGHT: "Over" },
    indoor: "Indoor cat",
    neutered: "Neutered",
    dryShare: "Dry food share",
    cats: "Number of cats",
    decrease: "Decrease",
    increase: "Increase",
    results: "Your monthly plan",
    daily: "Daily calories",
    dry: "Dry food",
    wet: "Wet pouches",
    litter: "Litter",
    treats: "Treats",
    suppl: "Supplements",
    cost: "Estimated cost",
    perMonth: "/ month",
    confidence: "Confidence",
    kgMo: "kg/mo",
    pouchesMo: "pouches/mo",
    packsMo: "packs/mo",
    unitsMo: "units/mo",
    kcal: "kcal",
    sar: SAR_EN,
    bridgeTitle: "A Moracat plan covers this",
    bridgeBody: "Food, litter and treats sized to your cat, delivered monthly — we carry the weight and age over, so you enter nothing twice.",
    bridgeCta: (name: string | null) => (name ? `Build ${name}'s plan` : "Build your cat's plan"),
  },
};

/* ── Accessible input primitives ─────────────────────────────────────────── */

/** Numeric stepper — labelled input + ≥44px −/+ buttons (R092/R095). */
function Stepper({
  id, label, value, min, max, step, onChange, decrease, increase, format,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  decrease: string;
  increase: string;
  format?: (v: number) => string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const decimals = step < 1 ? 1 : 0;
  const nudge = (dir: 1 | -1) => onChange(clamp(+((value + dir * step).toFixed(decimals))));
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => nudge(-1)}
          disabled={value <= min}
          aria-label={`${decrease} — ${label}`}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-input bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
        >
          <Minus className="size-4" />
        </button>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={format ? format(value) : value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(clamp(v));
          }}
          className="h-11 w-full rounded-full border border-input bg-card text-center font-display text-lg text-primary outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={() => nudge(1)}
          disabled={value >= max}
          aria-label={`${increase} — ${label}`}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-input bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  value, options, onChange, labels, groupLabel,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  labels: Record<string, string>;
  groupLabel: string;
}) {
  return (
    <div role="group" aria-label={groupLabel} className="flex rounded-full bg-muted p-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={cn(
            "min-h-11 flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-all",
            value === opt
              ? "bg-card text-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

/** Switch with a real accessible name — the visible row text labels it (R095). */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn(
        // The visual pill stays compact; the padding extends the target to 44px.
        "relative -m-2.5 box-content h-6 w-11 rounded-full p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-2.5 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted")}
      />
      <span
        aria-hidden
        className={cn(
          "absolute top-3 size-5 rounded-full bg-white shadow transition-all",
          checked ? "start-[1.875rem]" : "start-3"
        )}
      />
    </button>
  );
}

export default function FeedingCalculatorPage() {
  const { locale } = useLocale();
  const { user } = useAuth();
  const t = L[locale];
  const isAr = locale === "ar";

  const [weightKg, setWeightKg] = React.useState(4.5);
  const [ageMonths, setAgeMonths] = React.useState(36);
  const [activity, setActivity] = React.useState<Activity>("MODERATE");
  const [bodyCondition, setBodyCondition] = React.useState<Body>("IDEAL");
  const [isIndoor, setIsIndoor] = React.useState(true);
  const [neutered, setNeutered] = React.useState(true);
  const [dryShare, setDryShare] = React.useState(0.7);
  const [cats, setCats] = React.useState(1);

  // A name remembered from the homepage hero personalises the bridge (R082).
  const [pendingName, setPendingName] = React.useState<string | null>(null);
  React.useEffect(() => {
    try { setPendingName(sessionStorage.getItem("moraqat.pendingCatName")); } catch { /* ignore */ }
  }, []);
  const bridgeName = pendingName ? localizeName(pendingName, locale) : null;

  // Carry the profile into onboarding so nothing is typed twice (R002/R117).
  const rememberProfile = () => {
    try {
      if (pendingName) sessionStorage.setItem("moraqat.pendingCatName", pendingName);
      sessionStorage.setItem(
        "moraqat.pendingCatProfile",
        JSON.stringify({ name: pendingName ?? undefined, weightKg, ageMonths })
      );
    } catch { /* ignore */ }
  };

  const input: FeedingInput = {
    weightKg,
    ageMonths,
    activity,
    bodyCondition,
    isIndoor,
    neutered,
    dryShare,
    cats,
  };
  const rec = React.useMemo(() => calculateFeeding(input), [
    weightKg, ageMonths, activity, bodyCondition, isIndoor, neutered, dryShare, cats,
  ]);

  const confidencePct = Math.round(rec.confidence * 100);

  // Compact sticky summary on mobile — visible only while the full results
  // panel is off-screen, so the numbers follow the member as they adjust.
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const [resultsVisible, setResultsVisible] = React.useState(true);
  React.useEffect(() => {
    const el = resultsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setResultsVisible(entry?.isIntersecting ?? true));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const metrics = [
    { icon: Package, label: t.dry, value: rec.dryFoodKgPerMonth, unit: t.kgMo },
    { icon: Droplets, label: t.wet, value: rec.wetPouchesPerMonth, unit: t.pouchesMo },
    { icon: CatIcon, label: t.litter, value: rec.litterKgPerMonth, unit: t.kgMo },
    { icon: Sparkles, label: t.treats, value: rec.treatsPacksPerMonth, unit: t.packsMo },
    { icon: Sparkles, label: t.suppl, value: rec.supplementsPerMonth, unit: t.unitsMo },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section id="main" tabIndex={-1} className="container py-12 outline-none sm:py-16">
        {/* Warm editorial header — one sticker accent (R080). */}
        <div className="relative mx-auto mb-12 max-w-2xl text-center">
          <Sticker rotate={-12} className="-top-4 start-6 hidden sm:block">
            <IlloCan tone="pink" className="h-10 w-auto opacity-80" />
          </Sticker>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t.title}</h1>
          <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">{t.subtitle}</p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
          {/* ── Inputs ─────────────────────────────────────────── */}
          <Card className="p-6">
            <div className="space-y-6">
              <Stepper
                id="feeding-weight"
                label={t.weight}
                value={weightKg}
                min={0.5} max={12} step={0.1}
                onChange={setWeightKg}
                decrease={t.decrease} increase={t.increase}
                format={(v) => v.toFixed(1)}
              />

              <Stepper
                id="feeding-age"
                label={t.age}
                value={ageMonths}
                min={1} max={200} step={1}
                onChange={(v) => setAgeMonths(Math.round(v))}
                decrease={t.decrease} increase={t.increase}
              />

              <div>
                <p id="feeding-activity-label" className="mb-2 text-sm font-medium">{t.activity}</p>
                <Segmented
                  value={activity}
                  options={["LOW", "MODERATE", "HIGH"] as const}
                  onChange={setActivity}
                  labels={t.activityOpts}
                  groupLabel={t.activity}
                />
              </div>

              <div>
                <p id="feeding-body-label" className="mb-2 text-sm font-medium">{t.body}</p>
                <Segmented
                  value={bodyCondition}
                  options={["UNDERWEIGHT", "IDEAL", "OVERWEIGHT"] as const}
                  onChange={setBodyCondition}
                  labels={t.bodyOpts}
                  groupLabel={t.body}
                />
              </div>

              {/* Slider kept as the natural control for a percentage — properly
                  labelled via htmlFor/id (a11y first, enhancement second). */}
              <div>
                <label htmlFor="feeding-dry-share" className="mb-2 flex items-center justify-between text-sm font-medium">
                  {t.dryShare}
                  <span aria-hidden className="font-display text-lg text-primary">{Math.round(dryShare * 100)}%</span>
                </label>
                <input
                  id="feeding-dry-share"
                  type="range" min={0} max={1} step={0.05} value={dryShare}
                  onChange={(e) => setDryShare(+e.target.value)}
                  aria-valuetext={`${Math.round(dryShare * 100)}%`}
                  className="w-full accent-primary"
                />
              </div>

              <Stepper
                id="feeding-cats"
                label={t.cats}
                value={cats}
                min={1} max={6} step={1}
                onChange={(v) => setCats(Math.round(v))}
                decrease={t.decrease} increase={t.increase}
              />

              <div className="flex min-h-11 items-center justify-between border-t border-border pt-4">
                <span className="text-sm font-medium">{t.indoor}</span>
                <Toggle checked={isIndoor} onChange={setIsIndoor} label={t.indoor} />
              </div>
              <div className="flex min-h-11 items-center justify-between">
                <span className="text-sm font-medium">{t.neutered}</span>
                <Toggle checked={neutered} onChange={setNeutered} label={t.neutered} />
              </div>
            </div>
          </Card>

          {/* ── Results ────────────────────────────────────────── */}
          <div ref={resultsRef} className="space-y-4">
            {/* The headline number lives on a warm tinted panel — value made visible (R041). */}
            <Card className="relative overflow-hidden border-border/70 bg-butter/40 p-6 dark:bg-butter/15">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.daily}</p>
                  <p className="font-display text-4xl font-bold tabular">
                    {rec.dailyCalories}
                    <span className="ms-1 text-base font-normal text-muted-foreground">{t.kcal}</span>
                  </p>
                </div>
                <IlloFish
                  tone="orange"
                  className="mb-1.5 hidden h-6 w-auto rotate-[-6deg] opacity-70 rtl:-scale-x-100 sm:block"
                />
                <div className="text-end">
                  <p className="text-sm text-muted-foreground">{t.confidence}</p>
                  <p className="font-display text-2xl font-bold text-success tabular">{confidencePct}%</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  animate={{ width: `${confidencePct}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              {metrics.map((m) => (
                <Card key={m.label} className="p-4">
                  <span className="mb-2 grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <m.icon className="size-4" />
                  </span>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="font-display text-2xl font-bold">
                    {m.value}
                    <span className="ms-1 text-xs font-normal text-muted-foreground">{m.unit}</span>
                  </p>
                </Card>
              ))}

              <Card className="flex flex-col justify-center bg-primary p-4 text-primary-foreground">
                <span className="mb-2 grid size-9 place-items-center rounded-lg bg-white/15">
                  <Wallet className="size-4" />
                </span>
                <p className="text-xs opacity-80">{t.cost}</p>
                <p className="font-display text-2xl font-bold">
                  {formatAmount(rec.estimatedMonthlyCostSar, isAr)}
                  <span className="ms-1 text-xs font-normal opacity-80">
                    {t.sar} {t.perMonth}
                  </span>
                </p>
              </Card>
            </div>

            <p className="px-1 text-xs text-muted-foreground">
              {isAr
                ? `الأساس: طاقة الراحة ${rec.rationale.restingEnergyKcal} سعرة × معامل ${rec.rationale.energyFactor}.`
                : `Basis: resting energy ${rec.rationale.restingEnergyKcal} kcal × factor ${rec.rationale.energyFactor}.`}
            </p>

            {/* ── The bridge: this result is exactly what the plan delivers.
                One clear next step (R005), profile carried over (R002). ── */}
            <Card className="relative overflow-hidden border-primary/25 bg-gradient-to-br from-primary/[0.07] via-card to-card p-6">
              <IlloPaw tone="peach" className="pointer-events-none absolute -end-2 -top-2 size-12 rotate-12 opacity-30" />
              <h2 className="font-display text-xl font-semibold tracking-tight">{t.bridgeTitle}</h2>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{t.bridgeBody}</p>
              <Link
                href={user ? "/portal/subscribe" : "/register"}
                onClick={rememberProfile}
                className="mt-4 inline-block"
              >
                <Button size="lg">
                  {t.bridgeCta(bridgeName)} <ArrowRight className="size-4 rtl:rotate-180" />
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* Mobile: the numbers follow the member while results are off-screen. */}
      {!resultsVisible && (
        <div className="pb-safe fixed inset-x-3 bottom-3 z-30 lg:hidden">
          <div className="glass mx-auto flex max-w-md items-center justify-between gap-4 rounded-2xl px-5 py-3 shadow-soft-lg">
            <p className="text-sm">
              <span className="font-display text-lg font-bold tabular">{rec.dailyCalories}</span>{" "}
              <span className="text-muted-foreground">{t.kcal}</span>
            </p>
            <p className="text-sm">
              <span className="font-display text-lg font-bold tabular">{formatAmount(rec.estimatedMonthlyCostSar, isAr)}</span>{" "}
              <span className="text-muted-foreground">{t.sar} {t.perMonth}</span>
            </p>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
