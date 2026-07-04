"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Check, ArrowRight, ArrowLeft, Loader2, Star } from "lucide-react";
import { Card, Button, Badge, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { IlloHeart } from "@/components/illustrations";

interface ApiPlan {
  id: string;
  tier: "ESSENTIAL" | "PREMIUM" | "COMPLETE_CARE" | "MULTI_CAT";
  nameEn: string;
  nameAr: string;
  price: number;
  contents: { label: string; quantity: number; unit: string }[];
}

type Interval = "MONTHLY" | "BIMONTHLY" | "QUARTERLY";

interface Answers {
  cats: number;
  spend: "low" | "mid" | "high" | "vhigh";
  vet: "rare" | "yearly" | "quarterly" | "monthly";
  discounts: boolean;
  duration: Interval;
}

export default function SubscribePage() {
  return (
    <React.Suspense fallback={<div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
      <SubscribeInner />
    </React.Suspense>
  );
}

function SubscribeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const catId = params.get("cat");
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const { activeCats } = useCats();
  const isAr = locale === "ar";
  const qc = useQueryClient();

  const [step, setStep] = React.useState<0 | 1>(0);
  const [a, setA] = React.useState<Answers>({ cats: 0, spend: "mid", vet: "yearly", discounts: true, duration: "MONTHLY" });
  const [chosen, setChosen] = React.useState<string | null>(null);

  const { data: plans } = useQuery({ queryKey: ["plans"], queryFn: () => authedFetch<ApiPlan[]>("/plans"), enabled: !!user });

  // Which cats does this membership cover?
  const targetCats = React.useMemo(() => {
    if (catId) return activeCats.filter((c) => c.id === catId);
    return activeCats;
  }, [catId, activeCats]);

  React.useEffect(() => {
    setA((s) => ({ ...s, cats: s.cats || Math.max(1, activeCats.length) }));
  }, [activeCats.length]);

  const rec = React.useMemo(() => (plans ? recommend(a, plans, isAr) : null), [a, plans, isAr]);
  const recommendedId = rec?.plan.id ?? null;
  const selectedId = chosen ?? recommendedId;

  const subscribe = useMutation({
    mutationFn: (planId: string) =>
      authedFetch("/subscriptions", {
        method: "POST",
        body: JSON.stringify({ planId, interval: a.duration, catIds: targetCats.map((c) => c.id) }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cats"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      toast({ title: isAr ? "تم تفعيل العضوية 🎉" : "Membership activated 🎉", variant: "success" });
      router.push("/portal");
    },
    onError: (e: Error) => toast({ title: e.message, variant: "error" }),
  });

  const catLine = targetCats.map((c) => localizeName(c.name, isAr ? "ar" : "en")).join(isAr ? "، " : ", ");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="relative">
        <IlloHeart tone="pink" className="pointer-events-none absolute -top-2 end-0 size-9 rotate-[10deg] opacity-40" />
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-foreground/80">
          {isAr ? "الخطوة الأخيرة" : "Final step"}
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {isAr ? "فعّل عضوية " : "Activate membership for "}{catLine || (isAr ? "قططك" : "your cats")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAr
            ? "هوية قطك صدرت — تنشط العضوية وتفتح المزايا بعد الاشتراك."
            : "The Cat ID is issued — membership activates and unlocks benefits once you subscribe."}
        </p>
      </div>

      {step === 0 ? (
        <Card className="space-y-6 p-6">
          <h2 className="font-display text-lg font-semibold">{isAr ? "خلّنا نفهم احتياجك" : "Let's understand your needs"}</h2>

          <Q label={isAr ? "كم قط عندك؟" : "How many cats?"}
            value={String(a.cats)} onChange={(v) => setA({ ...a, cats: Number(v) })}
            opts={[["1", "1"], ["2", "2"], ["3", "3"], ["4", isAr ? "+٤" : "4+"]]} />

          <Q label={isAr ? "صرفك الشهري على الطعام تقريباً؟" : "Roughly your monthly food spend?"}
            value={a.spend} onChange={(v) => setA({ ...a, spend: v as Answers["spend"] })}
            opts={[["low", isAr ? "أقل من ١٥٠" : "< 150"], ["mid", "150–300"], ["high", "300–500"], ["vhigh", isAr ? "+٥٠٠" : "500+"]]} suffix="SAR" />

          <Q label={isAr ? "كم مرة تزور العيادة؟" : "How often do you visit the vet?"}
            value={a.vet} onChange={(v) => setA({ ...a, vet: v as Answers["vet"] })}
            opts={[["rare", isAr ? "نادراً" : "Rarely"], ["yearly", isAr ? "سنوياً" : "Yearly"], ["quarterly", isAr ? "كل ٣ شهور" : "Quarterly"], ["monthly", isAr ? "شهرياً" : "Monthly"]]} />

          <Q label={isAr ? "تهمّك خصومات العيادات والمتاجر؟" : "Care about vet & store discounts?"}
            value={a.discounts ? "y" : "n"} onChange={(v) => setA({ ...a, discounts: v === "y" })}
            opts={[["y", isAr ? "نعم" : "Yes"], ["n", isAr ? "مو ضروري" : "Not really"]]} />

          <Q label={isAr ? "مدة الاشتراك المفضّلة؟" : "Preferred delivery cadence?"}
            value={a.duration} onChange={(v) => setA({ ...a, duration: v as Interval })}
            opts={[["MONTHLY", isAr ? "شهري" : "Monthly"], ["BIMONTHLY", isAr ? "كل شهرين" : "Every 2 mo"], ["QUARTERLY", isAr ? "كل ٣ شهور" : "Quarterly"]]} />

          <div className="flex justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={() => router.push("/portal")}>{isAr ? "لاحقاً" : "Later"}</Button>
            <Button size="lg" onClick={() => setStep(1)}>{isAr ? "أرِني التوصية" : "See my recommendation"} <ArrowRight className="size-4 rtl:rotate-180" /></Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Recommendation with reasoning (#8) */}
          {rec && (
            <Card className="border-accent/30 bg-accent/[0.06] p-5">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="size-4 text-accent-foreground" />
                <span className="text-sm font-semibold">{isAr ? "الأنسب لك" : "Best fit for you"}</span>
                <Badge variant="secondary">{isAr ? rec.plan.nameAr : rec.plan.nameEn}</Badge>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {rec.reasons.map((r) => (
                  <li key={r} className="flex items-start gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-accent-foreground" /> {r}</li>
                ))}
              </ul>
            </Card>
          )}

          {/* Comparison — choose any (#7) */}
          <div className="grid gap-3 sm:grid-cols-2">
            {(plans ?? []).map((p) => {
              const selected = p.id === selectedId;
              const isRec = p.id === recommendedId;
              return (
                <button key={p.id} type="button" onClick={() => setChosen(p.id)}
                  className={cn("rounded-2xl border p-4 text-start transition-colors", selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:bg-muted")}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-display font-semibold">{isAr ? p.nameAr : p.nameEn}</span>
                    {isRec && <Star className="size-4 fill-accent text-accent" />}
                  </div>
                  <p className="font-display text-xl font-bold tabular" dir="ltr">{p.price} <span className="text-xs font-normal text-muted-foreground">SAR/mo</span></p>
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {p.contents.slice(0, 4).map((c) => (
                      <li key={c.label}>• {c.label} <span className="tabular" dir="ltr">{c.quantity}{c.unit}</span></li>
                    ))}
                  </ul>
                  {selected && <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"><Check className="size-3.5" /> {isAr ? "مختار" : "Selected"}</span>}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={() => setStep(0)}><ArrowLeft className="size-4 rtl:rotate-180" /> {isAr ? "الأسئلة" : "Questions"}</Button>
            <Button size="lg" disabled={!selectedId || subscribe.isPending} onClick={() => selectedId && subscribe.mutate(selectedId)}>
              {subscribe.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {isAr ? "اشترك وفعّل العضوية" : "Subscribe & activate"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Q({ label, value, onChange, opts, suffix }: {
  label: string; value: string; onChange: (v: string) => void; opts: [string, string][]; suffix?: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {opts.map(([v, l]) => (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors", value === v ? "border-primary bg-primary/10 font-medium text-foreground" : "border-border text-muted-foreground hover:bg-muted")}>
            {l}{suffix && v !== "low" && v !== "vhigh" ? "" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * #8 Recommendation engine — transparent, rule-based scoring over the live plan
 * catalogue. Returns the best-fit plan plus the reasons *why*, so the choice is
 * explained, never opaque. The user can still pick any plan.
 */
function recommend(a: Answers, plans: ApiPlan[], isAr: boolean): { plan: ApiPlan; reasons: string[] } {
  const reasons: string[] = [];
  let tier: ApiPlan["tier"];

  if (a.cats >= 2) {
    tier = "MULTI_CAT";
    reasons.push(isAr ? `عندك ${a.cats} قطط — الباقة متعددة القطط أوفر لكل قط.` : `You have ${a.cats} cats — the multi-cat plan is best value per cat.`);
  } else if (a.spend === "vhigh" || a.vet === "monthly" || a.vet === "quarterly") {
    tier = "COMPLETE_CARE";
    reasons.push(isAr ? "زياراتك المتكررة للعيادة تناسب العناية الكاملة (أسنان + مكمّلات)." : "Frequent vet visits fit Complete Care (dental + supplements).");
  } else if (a.spend === "high" || a.discounts) {
    tier = "PREMIUM";
    reasons.push(isAr ? "طعام فاخر + إثراء بقيمة واضحة، مع أفضل خصومات العضوية." : "Premium food + enrichment with the strongest member discounts.");
  } else {
    tier = "ESSENTIAL";
    reasons.push(isAr ? "احتياج يومي بسيط — الأساسية تغطيه باقتصادية." : "Simple everyday needs — Essential covers them economically.");
  }

  if (a.discounts) reasons.push(isAr ? "خصومات العيادات والمتاجر مفعّلة مع العضوية." : "Vet & store discounts come with the membership.");
  reasons.push(isAr ? `توصيل ${a.duration === "MONTHLY" ? "شهري" : a.duration === "BIMONTHLY" ? "كل شهرين" : "كل ٣ شهور"} حسب تفضيلك.` : `${a.duration === "MONTHLY" ? "Monthly" : a.duration === "BIMONTHLY" ? "Bi-monthly" : "Quarterly"} delivery, as you prefer.`);

  const plan = plans.find((p) => p.tier === tier) ?? plans[0]!;
  return { plan, reasons };
}
