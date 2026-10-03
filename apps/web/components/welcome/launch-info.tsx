"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Palette, Truck, RefreshCcw, Cat, BadgePercent, IdCard, HeartPulse, Bell, Users, Search } from "lucide-react";
import { Button, cn } from "@moraqat/ui";
import { formatNumber, formatPercent, formatSAR, MAX_CATS_PER_SUBSCRIPTION, RENEWAL_SHORT, TERM_DISCOUNTS } from "@moraqat/core";
import { PLANS } from "@/lib/plans";
import { useCensus } from "@/components/census-counter";
import { Illo3D } from "@/components/illo-3d";
import { IlloHeart, IlloPaw, Sticker } from "@/components/illustrations";
import { Sparkles } from "@/components/home/sparkles";

/**
 * "What you just joined" — shown right after sign-up (the ceremony hands off
 * here, then on to the card designer). Founder brief, 2026-10-03: say what
 * Moracat is, the monthly membership's starting price, what each plan
 * includes, the discounts — and that memberships open once the register
 * reaches 1,000 cats.
 *
 * Every number is read from the one price list (@moraqat/core plans) and the
 * live census; nothing on this page is typed twice, so it can never quote a
 * price checkout wouldn't honour (R021) or a count that isn't real (R006).
 */
export function LaunchInfo({ catId, catName, isAr }: { catId: string | null; catName: string | null; isAr: boolean }) {
  const loc = isAr ? "ar" : "en";
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const { data: census } = useCensus();
  const target = census?.foundingLimit ?? 1000;
  const registered = census?.registered ?? null;
  const pct = registered != null ? Math.min(100, Math.round((registered / target) * 100)) : null;
  const opened = registered != null && registered >= target;

  const plans = [...PLANS].sort((a, b) => a.price - b.price);
  const from = plans[0]!;
  const adultFrom = plans.filter((p) => !p.kitten).sort((a, b) => a.price - b.price)[0]!;
  const sar = (n: number) => formatSAR(n, loc);
  const designHref = catId ? `/portal/cats/new?cat=${catId}&step=design` : "/portal";
  const name = catName ?? t("قطك", "your cat");

  const free = [
    { icon: IdCard, ar: "هوية دائمة برقم لا يتكرر، ورمز على الطوق يوصل من يلقاه بك", en: "A permanent ID with a unique number, and a collar code that connects finders to you" },
    { icon: HeartPulse, ar: "سجل صحي ينتقل معه لأي عيادة — برابط مؤقت تتحكم فيه", en: "A health record that travels to any clinic — via a temporary link you control" },
    { icon: Bell, ar: "تذكير بالتطعيمات والوزن والفحص السنوي، وملخص أسبوعي", en: "Reminders for vaccines, weigh-ins and the yearly check-up, plus a weekly note" },
    { icon: Search, ar: "مفقود وموجود: نداء بحث يصل الحي كله دون كشف رقمك", en: "Lost & found: a search notice that reaches the neighbourhood without your number" },
    { icon: Users, ar: "صفحة لقطك في مجتمع مرقط، وألبوم لحياته كلها", en: "A page in the Moracat community, and an album for their whole life" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-16">
      {/* ── 1 · Welcome + what Moracat is ───────────────────────────────── */}
      <section className="mesh-bg-rich relative overflow-hidden rounded-[2.5rem] border border-border bg-card p-7 shadow-e2 sm:p-12">
        <Sparkles preset="hero" />
        <Sticker rotate={-12} className="end-8 top-8 hidden sm:block"><IlloHeart tone="pink" className="size-10" /></Sticker>
        <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-4 py-1.5 text-sm font-medium text-primary shadow-e1">
              <IlloPaw tone="orange" className="size-4" /> {t("أهلاً بك في مرقط", "Welcome to Moracat")}
            </span>
            <h1 className="font-display text-4xl leading-tight sm:text-5xl">
              {t(`${name} صار في سجل مرقط`, `${name} is in the Moracat register`)}
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {t(
                "مرقط سجل خاص لقطط السعودية تديره شركة سعودية: لكل قط هوية دائمة برقمه، وسجل صحي يمشي معه، وعناية تتذكّر عنك — وكل هذا مجاني من اليوم. وقريباً: اشتراك شهري يوصل أكله ورمله لبابك.",
                "Moracat is a private register for Saudi Arabia's cats, run by a Saudi company: every cat gets a permanent numbered ID, a health record that travels with them, and care that remembers for you — all free from today. Soon: a monthly membership that delivers their food and litter to your door."
              )}
            </p>
          </div>
          <Illo3D name="collar" px={176} className="mx-auto size-40 motion-safe:animate-float sm:size-44" priority />
        </div>
      </section>

      {/* ── 2 · Free, from today ──────────────────────────────────────────── */}
      <section aria-labelledby="free-h" className="space-y-4">
        <h2 id="free-h" className="font-display text-3xl">{t("مجاني لك من اليوم", "Free for you, from today")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {free.map((f) => (
            <li key={f.en} className="flex items-start gap-3 rounded-[1.5rem] border border-border bg-card p-4 shadow-e1">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><f.icon className="size-5" aria-hidden /></span>
              <span className="text-sm leading-relaxed">{isAr ? f.ar : f.en}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 3 · The launch gate: 1,000 cats ─────────────────────────────── */}
      <section aria-labelledby="gate-h" className="relative overflow-hidden rounded-[2.5rem] bg-primary p-7 text-primary-foreground shadow-e2 sm:p-10">
        <Sparkles preset="band" />
        <div className="relative space-y-5">
          <h2 id="gate-h" className="font-display text-3xl sm:text-4xl">
            {opened
              ? t("وصلنا 1000 قط — الاشتراكات تفتح قريباً جداً", "We reached 1,000 cats — memberships open very soon")
              : t("الاشتراك الشهري يفتح عند وصولنا 1000 قط", "Memberships open when we reach 1,000 cats")}
          </h2>
          <p className="max-w-2xl text-primary-foreground/85">
            {t(
              "نبدأ التوصيل لما يكتمل أول 1000 قط في السجل — عشان نفتح بأسعار ثابتة وتوصيل منتظم من أول يوم. قطك محسوب من الآن، وأنت أول من يعرف لما نفتح.",
              "Deliveries start once the first 1,000 cats are in the register — so we open with steady prices and reliable delivery from day one. Your cat already counts, and you'll be the first to know when we open."
            )}
          </p>
          <div className="max-w-xl space-y-2">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{t("قطط في السجل الآن", "Cats in the register now")}</span>
              <span dir="ltr" className="font-mono">
                {registered != null ? `${formatNumber(registered, loc)} / ${formatNumber(target, loc)}` : `— / ${formatNumber(target, loc)}`}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={registered ?? 0} aria-label={t("التقدم نحو 1000 قط", "Progress to 1,000 cats")}>
              <div className="h-full rounded-full bg-[hsl(var(--accent))] transition-[width] duration-700" style={{ width: `${pct ?? 0}%` }} />
            </div>
            <p className="text-xs text-primary-foreground/75">
              {t("أول 1000 قط يحملون صفة «عضو مؤسِّس» في هويتهم — دايماً.", "The first 1,000 cats carry “Founding Member” on their ID — permanently.")}
            </p>
          </div>
          <Link href="/portal" className="inline-flex text-sm font-medium underline underline-offset-4 hover:no-underline">
            {t("ادعُ صديقاً عنده قط — كل قط يقرّبنا من الافتتاح", "Invite a friend with a cat — every cat brings opening day closer")}
          </Link>
        </div>
      </section>

      {/* ── 4 · The membership: price + what's inside ──────────────────── */}
      <section aria-labelledby="plans-h" className="space-y-5">
        <div className="space-y-2">
          <h2 id="plans-h" className="font-display text-3xl sm:text-4xl">
            {t(`الاشتراك الشهري يبدأ من ${sar(from.price)}`, `The monthly membership starts at ${sar(from.price)}`)}
          </h2>
          <p className="text-muted-foreground">
            {t(
              `${sar(from.price)} لخطة الصغار (3–8 أشهر)، وخطط البالغين من ${sar(adultFrom.price)}. صندوق كل شهر لبابك — والسعر يشمل القط الأول.`,
              `${sar(from.price)} for the kitten plan (3–8 months); adult plans from ${sar(adultFrom.price)}. A box at your door every month — the price covers the first cat.`
            )}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <article
              key={p.tier}
              className={cn(
                "relative flex flex-col rounded-[2rem] border bg-card p-5 shadow-e1",
                p.popular ? "border-primary ring-2 ring-primary/20" : "border-border"
              )}
            >
              {p.popular && (
                <span className="absolute -top-3 start-5 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                  {t("الأكثر اختياراً", "Most chosen")}
                </span>
              )}
              <h3 className="font-display text-2xl">{isAr ? p.nameAr : p.nameEn}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{isAr ? p.taglineAr : p.taglineEn}</p>
              <p className="mt-4">
                <span className="text-3xl font-semibold tabular-nums">{sar(p.price)}</span>
                <span className="text-sm text-muted-foreground"> {t("/ شهرياً", "/ month")}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {t(`كل قط إضافي +${sar(p.modulePrice)}`, `Each extra cat +${sar(p.modulePrice)}`)}
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {(isAr ? p.featuresAr : p.featuresEn).map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={3} aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* ── 5 · Discounts and the fine print, said plainly ─────────────── */}
      <section aria-labelledby="terms-h" className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-[2rem] border border-border bg-card p-6 shadow-e1">
          <h2 id="terms-h" className="flex items-center gap-2 font-display text-2xl">
            <BadgePercent className="size-5 text-primary" aria-hidden /> {t("الخصومات", "Discounts")}
          </h2>
          <ul className="divide-y divide-border">
            {([1, 3, 6, 12] as const).map((m) => {
              const d = TERM_DISCOUNTS[m];
              return (
                <li key={m} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>{t(m === 1 ? "شهر واحد" : `${m} أشهر`, m === 1 ? "1 month" : `${m} months`)}{m === 3 ? t(" · المقترح", " · recommended") : ""}</span>
                  <span className={cn("font-medium", d > 0 && "text-success")}>
                    {d > 0 ? t(`خصم ${formatPercent(d, loc)}`, `${formatPercent(d, loc)} off`) : t("بدون خصم", "No discount")}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            {t("تدفع المدة كاملة مقدّماً، والخصم يُحسب على إجماليها.", "The term is paid upfront; the discount applies to its total.")}
          </p>
        </div>
        <div className="space-y-3 rounded-[2rem] border border-border bg-card p-6 shadow-e1">
          <h2 className="font-display text-2xl">{t("بوضوح", "Plainly")}</h2>
          <Fine icon={Cat}>
            {t(`أكثر من قط؟ اشتراك واحد للبيت حتى ${MAX_CATS_PER_SUBSCRIPTION} قطط — كل قط إضافي بسعر أقل.`, `More than one cat? One household membership for up to ${MAX_CATS_PER_SUBSCRIPTION} cats — each extra cat costs less.`)}
          </Fine>
          <Fine icon={RefreshCcw}>{isAr ? RENEWAL_SHORT.ar : RENEWAL_SHORT.en}</Fine>
          <Fine icon={Truck}>{t("التوصيل في البداية للرياض وجدة، وبقية المدن تباعاً.", "Delivery starts in Riyadh and Jeddah, with more cities to follow.")}</Fine>
          <Fine icon={Check}>{t("أسعار نهائية — لا رسوم خفية.", "Final prices — no hidden fees.")}</Fine>
        </div>
      </section>

      {/* ── 6 · Next: make the card theirs ─────────────────────────────── */}
      <section className="mesh-bg-rich relative overflow-hidden rounded-[2.5rem] border border-border bg-card px-6 py-10 text-center shadow-e2">
        <Sparkles preset="panel" />
        <div className="relative space-y-4">
          <div className="flex justify-center gap-1" aria-hidden>
            {["crown", "heart", "sparkle"].map((s, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s} src={`/brand/stickers/${s}.svg`} alt="" className="size-12" style={{ transform: `rotate(${(i - 1) * 10}deg)` }} />
            ))}
          </div>
          <h2 className="font-display text-3xl">{t(`الحين: صمّم بطاقة ${name}`, `Now: design ${name}'s card`)}</h2>
          <p className="mx-auto max-w-md text-muted-foreground">
            {t("اختر الخلفية والإطار والملصقات — تظهر في المجتمع وفي كل مشاركة.", "Pick the theme, frame and stickers — it shows in the community and in every share.")}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={designHref}>
              <Button size="lg" className="btn-shine rounded-full px-8">
                <Palette className="size-4" aria-hidden /> {t("صمّم البطاقة", "Design the card")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Button>
            </Link>
            <Link href={catId ? `/portal/cats/${catId}` : "/portal"} className="inline-flex h-11 items-center rounded-full border border-border bg-card px-6 text-sm font-medium hover:bg-muted">
              {t(`ملف ${name}`, `${name}'s profile`)}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Fine({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-3 text-sm leading-relaxed">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
