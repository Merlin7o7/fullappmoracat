"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Droplets, Package, Sparkles, Cat as CatIcon, Wallet } from "lucide-react";
import { calculateFeeding, type FeedingInput } from "@moraqat/core";
import { Card, cn } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IlloCan, IlloFish, Sticker } from "@/components/illustrations";
import { useLocale } from "@/app/providers";

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
    sar: "ريال",
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
    sar: "SAR",
  },
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
  labels,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  labels: Record<string, string>;
}) {
  return (
    <div className="flex rounded-full bg-muted p-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-all",
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

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted"
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
          checked ? "start-[1.375rem]" : "start-0.5"
        )}
      />
    </button>
  );
}

export default function FeedingCalculatorPage() {
  const { locale } = useLocale();
  const t = L[locale];

  const [weightKg, setWeightKg] = React.useState(4.5);
  const [ageMonths, setAgeMonths] = React.useState(36);
  const [activity, setActivity] = React.useState<Activity>("MODERATE");
  const [bodyCondition, setBodyCondition] = React.useState<Body>("IDEAL");
  const [isIndoor, setIsIndoor] = React.useState(true);
  const [neutered, setNeutered] = React.useState(true);
  const [dryShare, setDryShare] = React.useState(0.7);
  const [cats, setCats] = React.useState(1);

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

      <section className="container py-12 sm:py-16">
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
              <div>
                <label className="mb-2 flex items-center justify-between text-sm font-medium">
                  {t.weight}
                  <span className="font-display text-lg text-primary">{weightKg.toFixed(1)}</span>
                </label>
                <input
                  type="range" min={0.5} max={12} step={0.1} value={weightKg}
                  onChange={(e) => setWeightKg(+e.target.value)}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <label className="mb-2 flex items-center justify-between text-sm font-medium">
                  {t.age}
                  <span className="font-display text-lg text-primary">{ageMonths}</span>
                </label>
                <input
                  type="range" min={1} max={200} step={1} value={ageMonths}
                  onChange={(e) => setAgeMonths(+e.target.value)}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">{t.activity}</p>
                <Segmented
                  value={activity}
                  options={["LOW", "MODERATE", "HIGH"] as const}
                  onChange={setActivity}
                  labels={t.activityOpts}
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">{t.body}</p>
                <Segmented
                  value={bodyCondition}
                  options={["UNDERWEIGHT", "IDEAL", "OVERWEIGHT"] as const}
                  onChange={setBodyCondition}
                  labels={t.bodyOpts}
                />
              </div>

              <div>
                <label className="mb-2 flex items-center justify-between text-sm font-medium">
                  {t.dryShare}
                  <span className="font-display text-lg text-primary">{Math.round(dryShare * 100)}%</span>
                </label>
                <input
                  type="range" min={0} max={1} step={0.05} value={dryShare}
                  onChange={(e) => setDryShare(+e.target.value)}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <label className="mb-2 flex items-center justify-between text-sm font-medium">
                  {t.cats}
                  <span className="font-display text-lg text-primary">{cats}</span>
                </label>
                <input
                  type="range" min={1} max={6} step={1} value={cats}
                  onChange={(e) => setCats(+e.target.value)}
                  className="w-full accent-primary"
                />
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm font-medium">{t.indoor}</span>
                <Toggle checked={isIndoor} onChange={setIsIndoor} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t.neutered}</span>
                <Toggle checked={neutered} onChange={setNeutered} />
              </div>
            </div>
          </Card>

          {/* ── Results ────────────────────────────────────────── */}
          <div className="space-y-4">
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
                  {rec.estimatedMonthlyCostSar}
                  <span className="ms-1 text-xs font-normal opacity-80">
                    {t.sar} {t.perMonth}
                  </span>
                </p>
              </Card>
            </div>

            <p className="px-1 text-xs text-muted-foreground">
              {locale === "ar"
                ? `الأساس: طاقة الراحة ${rec.rationale.restingEnergyKcal} سعرة × معامل ${rec.rationale.energyFactor}.`
                : `Basis: resting energy ${rec.rationale.restingEnergyKcal} kcal × factor ${rec.rationale.energyFactor}.`}
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
