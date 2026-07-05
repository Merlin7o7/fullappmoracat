"use client";

// ════════════════════════════════════════════════════════════════════════
//  Community Mode — "Memberships are launching soon".
//  Every Subscribe / Activate / Upgrade / Renew CTA funnels here. There is NO
//  checkout, no payment, no activation path on this page by design. Visitors
//  see the benefits, a premium preview, and can join the launch waitlist.
//  Re-enable the real subscribe flow (git history) once payments go live.
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
  Percent,
  Loader2,
  Lock,
} from "lucide-react";
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

type Interest = "ESSENTIAL" | "PREMIUM" | "COMPLETE_CARE" | "MULTI_CAT" | "unsure";

export default function SubscribePage() {
  return (
    <React.Suspense
      fallback={
        <div className="grid place-items-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ComingSoonInner />
    </React.Suspense>
  );
}

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
      icon: Percent,
      titleAr: "خصومات العضوية",
      titleEn: "Member savings",
      bodyAr: "أسعار أعضاء على الطعام والمستلزمات — قيمة واضحة كل شهر.",
      bodyEn: "Member pricing on food & essentials — visible value every month.",
    },
    {
      icon: Stethoscope,
      titleAr: "مزايا العيادات",
      titleEn: "Vet perks",
      bodyAr: "خصومات على العيادات والفحوصات لدى شركائنا.",
      bodyEn: "Discounts on partner clinics and check-ups.",
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
                {isAr
                  ? "سنراسلك على بريدك لحظة فتح العضويات. لا حاجة لأي إجراء الآن."
                  : "We'll email you the moment memberships open. Nothing to do for now."}
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
                  ["ESSENTIAL", isAr ? "الأساسية" : "Essential"],
                  ["PREMIUM", isAr ? "المميزة" : "Premium"],
                  ["COMPLETE_CARE", isAr ? "العناية الكاملة" : "Complete Care"],
                  ["MULTI_CAT", isAr ? "متعددة القطط" : "Multi-cat"],
                  ["unsure", isAr ? "لست متأكداً" : "Not sure yet"],
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
