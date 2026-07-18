"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Check, Star, ArrowRight } from "lucide-react";
import { Button, cn } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CatIdCard } from "@/components/cat-id-card";
import {
  IlloCat, IlloCan, IlloFish, IlloHeart, IlloMouse, IlloPaw, IlloSprig,
  Sticker, PawTrail, type Tone,
} from "@/components/illustrations";
import { useLocale } from "./providers";
import { PLANS } from "@/lib/plans";
import { api } from "@/lib/api";
import { commerceEnabled } from "@/lib/features";
import { localizeName } from "@/lib/translit";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

// A clearly-illustrative preview number (real IDs are issued on join).
const PREVIEW_ID = "MRC-2K9F-7YQ3";

export default function HomePage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const isAr = locale === "ar";
  const [catName, setCatName] = React.useState("");
  // A name remembered from an earlier visit (hero form / feeding tool) lets the
  // closing invitation greet the cat personally (R001/R082).
  const [storedName, setStoredName] = React.useState("");
  React.useEffect(() => {
    try { setStoredName(sessionStorage.getItem("moraqat.pendingCatName") ?? ""); } catch { /* ignore */ }
  }, []);
  const greetName = catName.trim() || storedName;
  const closingTitle = greetName
    ? t.closing.titleNamed.replace("{name}", localizeName(greetName, locale))
    : t.closing.title;

  const rememberName = () => {
    if (catName.trim()) {
      try { sessionStorage.setItem("moraqat.pendingCatName", catName.trim()); } catch { /* ignore */ }
    }
  };

  // Enter in the name field goes forward too — the obvious gesture works (R002).
  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    rememberName();
    router.push("/register");
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* ── Hero · identity first (Dossier Stage 1 + §05) ────────────────── */}
      <section id="main" tabIndex={-1} className="mesh-bg relative overflow-hidden outline-none">
        <div className="container grid items-center gap-14 py-14 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          {/* Left · the promise */}
          <div className="relative text-center lg:text-start">
            <motion.p
              variants={fadeUp} initial="hidden" animate="show"
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary shadow-e1"
            >
              <IlloPaw tone="orange" className="size-4" />
              {t.hero.badge}
            </motion.p>

            <motion.h1
              variants={fadeUp} initial="hidden" animate="show" custom={1}
              className="mx-auto max-w-2xl font-display text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:mx-0 lg:text-7xl"
            >
              {t.hero.title}{" "}
              {/* Wrap is allowed below sm — nowrap on a long Arabic accent
                  overflowed narrow phones (R094-adjacent: survive small widths). */}
              <span className="underline-marker sm:whitespace-nowrap">{t.hero.titleAccent}</span>
            </motion.h1>

            <motion.p
              variants={fadeUp} initial="hidden" animate="show" custom={2}
              className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0"
            >
              {t.hero.subtitle}
            </motion.p>

            {/* Cat's name first (R016) — a taste of belonging before any ask (R011/R017) */}
            <motion.form
              variants={fadeUp} initial="hidden" animate="show" custom={3}
              onSubmit={submitName}
              className="mx-auto mt-9 max-w-md lg:mx-0"
            >
              <label htmlFor="hero-cat-name" className="mb-2.5 block text-sm font-medium text-foreground/80">
                {t.hero.namePrompt}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:border sm:border-input sm:bg-card sm:p-1.5 sm:ps-5 sm:shadow-e2 sm:focus-within:ring-2 sm:focus-within:ring-ring">
                <input
                  id="hero-cat-name"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value.slice(0, 24))}
                  placeholder={t.hero.namePlaceholder}
                  className="h-13 flex-1 rounded-full border border-input bg-card px-5 text-base shadow-e1 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring sm:h-11 sm:border-0 sm:bg-transparent sm:px-0 sm:shadow-none sm:focus-visible:ring-0"
                />
                <Link href="/register" onClick={rememberName} className="sm:shrink-0">
                  <Button size="lg" className="w-full sm:h-11 sm:w-auto sm:px-6">
                    {t.hero.cta} <ArrowRight className="size-4 rtl:rotate-180" />
                  </Button>
                </Link>
              </div>
              <p className="mt-3.5 text-xs text-muted-foreground">{t.hero.trust}</p>
              {/* Quiet secondary path for the unconvinced (R005: still one primary action). */}
              <p className="mt-2.5 text-sm">
                <Link
                  href="/#how"
                  className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t.hero.ctaSecondary}
                </Link>
              </p>
            </motion.form>
          </div>

          {/* Right · the artifact, updating live as they type */}
          <motion.div
            variants={fadeUp} initial="hidden" animate="show" custom={2}
            className="relative mx-auto w-full max-w-sm"
          >
            {/* The sticker sheet around the card — depth without noise. */}
            <Sticker rotate={-14} float className="-start-10 -top-8 hidden sm:block" delay={0.4}>
              <IlloMouse tone="sage" className="h-12 w-auto rtl:-scale-x-100" />
            </Sticker>
            <Sticker rotate={10} float className="-end-7 -top-10 hidden sm:block">
              <IlloHeart tone="pink" className="size-10" />
            </Sticker>
            <Sticker rotate={16} float className="-bottom-9 -end-9 hidden sm:block" delay={0.9}>
              <IlloPaw tone="butter" className="size-14" />
            </Sticker>
            <Sticker rotate={-18} className="-bottom-12 -start-7 hidden sm:block">
              <IlloSprig tone="leaf" className="h-20 w-auto opacity-70" />
            </Sticker>

            <TiltCard>
              <CatIdCard
                catName={catName.trim() || (isAr ? "قطك" : "Your cat")}
                catIdNumber={PREVIEW_ID}
                isAr={isAr}
                preview
                className="shadow-glow"
              />
            </TiltCard>
            <p className="mt-5 text-center text-xs text-muted-foreground">{t.hero.previewNote}</p>
          </motion.div>
        </div>

        <PawTrail steps={6} tone="peach" className="absolute bottom-4 start-1/2 hidden -translate-x-1/2 lg:flex" />
      </section>

      {/* ── Benefits ribbon — the promises, on repeat ─────────────────────── */}
      <BenefitsRibbon items={[...t.marquee]} />

      {/* ── Membership pillars (Dossier §01 / §04) — editorial rows ──────── */}
      <section id="how" className="container py-20 sm:py-24">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t.features.title}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t.features.lede}</p>
        </div>

        <div className="space-y-6 sm:space-y-8">
          {t.features.items.map((f, i) => (
            <FeatureRow key={f.title} index={i} eyebrow={f.eyebrow} title={f.title} body={f.body} flip={i % 2 === 1} />
          ))}
        </div>
      </section>

      {/* ── One membership, built from the cat (D2/R021/R085) — the plan is
           computed from the cat's profile, never chosen from a tier table. ── */}
      <section id="plans" className="border-y border-border/70 bg-cream/60 py-20 sm:py-24">
        <div className="container">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t.plans.title}</h2>
            <p className="mt-4 text-lg text-muted-foreground">{t.plans.subtitle}</p>
          </div>

          <motion.div
            variants={fadeUp} initial="hidden" whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
          >
            <MembershipPanel t={t} />
          </motion.div>
        </div>
      </section>

      {/* ── Member voices · social proof (Dossier Stage 1 trust) ─────────── */}
      <MemberVoices isAr={isAr} title={t.voices.title} />

      {/* ── Quiet FAQ — the four questions that precede trust (R004/R021) ── */}
      <section aria-labelledby="faq-title" className="container pb-4 pt-20 sm:pt-24">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq-title" className="mb-8 text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {t.faq.title}
          </h2>
          <div className="divide-y divide-border overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-e1">
            {t.faq.items.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-start font-medium transition-colors [&::-webkit-details-marker]:hidden hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  {item.q}
                  <span aria-hidden className="text-lg text-muted-foreground transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing invitation ────────────────────────────────────────────── */}
      <section className="container py-20 sm:py-24">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-border bg-card px-6 py-16 text-center shadow-e2 sm:py-20">
          <Sticker rotate={-12} className="start-8 top-8 hidden md:block">
            <IlloHeart tone="orange" className="size-9 opacity-80" />
          </Sticker>
          <Sticker rotate={14} className="end-10 top-12 hidden md:block">
            <IlloPaw tone="sage" className="size-12 opacity-70" />
          </Sticker>
          <Sticker rotate={-8} className="bottom-6 start-16 hidden md:block">
            <IlloCan tone="pink" className="h-16 w-auto opacity-80" />
          </Sticker>
          <Sticker rotate={10} className="-bottom-2 end-20 hidden md:block">
            <IlloMouse tone="peach" className="h-10 w-auto" />
          </Sticker>

          <h2 className="mx-auto max-w-xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            {closingTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">{t.closing.sub}</p>
          <Link href="/register" className="mt-9 inline-block">
            <Button size="xl">
              {t.hero.cta} <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ── The tilting artifact — richest motion is reserved for the ID (R073) ── */

function TiltCard({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 160, damping: 18 });
  const sry = useSpring(ry, { stiffness: 160, damping: 18 });

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 14);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 12);
  };
  const onLeave = () => { rx.set(0); ry.set(0); };

  return (
    <motion.div
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 900 }}
      className="will-change-transform"
    >
      <div className={reduced ? undefined : "animate-float"}>{children}</div>
    </motion.div>
  );
}

/* ── Benefits ribbon ─────────────────────────────────────────────────────── */

function BenefitsRibbon({ items }: { items: string[] }) {
  const icons = [
    <IlloPaw key="p" tone="orange" className="size-5" />,
    <IlloHeart key="h" tone="pink" className="size-5" />,
    <IlloFish key="f" tone="orange" className="h-4 w-auto" />,
    <IlloMouse key="m" tone="sage" className="h-5 w-auto" />,
    <IlloSprig key="s" tone="leaf" className="h-5 w-auto" />,
  ];
  // Doubled content + translateX(-50%) = a seamless loop. Track runs LTR so
  // the animation math holds in both locales; each item renders its own dir.
  const track = [...items, ...items];
  return (
    <>
      {/* The moving ribbon is decorative; its promises must still exist for
          screen readers (R095) — a static, visually-hidden copy carries them. */}
      <ul className="sr-only">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div aria-hidden className="marquee-pause overflow-hidden border-y border-border/70 bg-cream py-4" dir="ltr">
      <div className="animate-marquee flex w-max items-center gap-10">
        {track.map((item, i) => (
          <span key={i} className="flex items-center gap-10">
            <span dir="auto" className="whitespace-nowrap font-display text-lg font-medium text-cream-foreground/90">
              {item}
            </span>
            {icons[i % icons.length]}
          </span>
        ))}
        </div>
      </div>
    </>
  );
}

/* ── Editorial feature rows ─────────────────────────────────────────────── */

const FEATURE_ART: { tint: string; art: React.ReactNode }[] = [
  {
    tint: "bg-cream",
    art: (
      <>
        <IlloCat tone="green" className="h-40 w-auto sm:h-48" />
        <Sticker rotate={12} className="end-8 top-8"><IlloPaw tone="butter" className="size-10" /></Sticker>
        <Sticker rotate={-10} className="bottom-8 start-10"><IlloHeart tone="orange" className="size-8" /></Sticker>
      </>
    ),
  },
  {
    tint: "bg-butter/50 dark:bg-butter/15",
    art: (
      <>
        <IlloMouse tone="sage" className="h-24 w-auto sm:h-28" />
        <Sticker rotate={-14} className="start-10 top-10"><IlloHeart tone="pink" className="size-9" /></Sticker>
        <Sticker rotate={8} className="bottom-10 end-12"><IlloPaw tone="peach" className="size-9" /></Sticker>
      </>
    ),
  },
  {
    tint: "bg-blush/40 dark:bg-blush/15",
    art: (
      <>
        <IlloCan tone="green" className="h-36 w-auto sm:h-44" />
        <Sticker rotate={10} className="end-10 bottom-8"><IlloFish tone="orange" className="h-8 w-auto" /></Sticker>
        <Sticker rotate={-12} className="start-9 top-9"><IlloPaw tone="sage" className="size-9" /></Sticker>
      </>
    ),
  },
  {
    tint: "bg-sage/15 dark:bg-sage/10",
    art: (
      <>
        <IlloCan tone="pink" className="h-32 w-auto sm:h-40" />
        <Sticker rotate={14} className="end-9 top-9"><IlloSprig tone="leaf" className="h-16 w-auto" /></Sticker>
        <Sticker rotate={-8} className="bottom-9 start-10"><IlloHeart tone="orange" className="size-8" /></Sticker>
      </>
    ),
  },
];

/* Each pillar is one of the membership's jobs — the chip names it honestly
 * (two for the cat, two for the owner), like a sticker pressed on the page. */
const PILLAR_CHIP = [
  "bg-cream text-cream-foreground/80 -rotate-2",
  "bg-butter/70 text-foreground/75 rotate-1 dark:bg-butter/20",
  "bg-blush/60 text-foreground/75 -rotate-1 dark:bg-blush/20",
  "bg-sage/25 text-foreground/75 rotate-2",
];

function FeatureRow({ index, eyebrow, title, body, flip }: { index: number; eyebrow: string; title: string; body: string; flip: boolean }) {
  const art = FEATURE_ART[index % FEATURE_ART.length] ?? FEATURE_ART[0]!;
  return (
    <motion.div
      variants={fadeUp} initial="hidden" whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className="grid items-stretch gap-6 lg:grid-cols-2 lg:gap-8"
    >
      {/* Copy panel */}
      <div className={cn("relative flex flex-col items-start justify-center rounded-[2rem] border border-border bg-card p-8 shadow-e1 sm:p-12", flip && "lg:order-2")}>
        <span className={cn("inline-flex items-center rounded-full border border-foreground/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em]", PILLAR_CHIP[index % PILLAR_CHIP.length])}>
          {eyebrow}
        </span>
        <h3 className="mt-5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h3>
        <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">{body}</p>
      </div>

      {/* Illustration panel */}
      <div className={cn("relative grid min-h-56 place-items-center overflow-hidden rounded-[2rem] border border-border/60 p-8 sm:min-h-72", art.tint, flip && "lg:order-1")}>
        {art.art}
      </div>
    </motion.div>
  );
}

/* ── The membership panel — one plan, computed from the cat (D2) ────────── */

function MembershipPanel({ t }: { t: ReturnType<typeof useLocale>["t"] }) {
  const commerce = commerceEnabled();
  const fromPrice = Math.min(...PLANS.map((p) => p.price));

  return (
    <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-e2">
      <div className="grid lg:grid-cols-[1.2fr_1fr]">
        {/* What the membership carries */}
        <div className="p-8 sm:p-10">
          <ul className="flex flex-col gap-4">
            {t.plans.includes.map((item) => (
              <li key={item} className="flex items-start gap-3 text-base">
                <Check className="mt-1 size-5 shrink-0 text-success" strokeWidth={3} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-7 text-xs text-muted-foreground">{t.plans.vatNote}</p>
        </div>

        {/* The honest price + one action (R021/R086) */}
        <div className="relative flex flex-col items-center justify-center gap-4 border-t border-dashed border-border bg-cream/70 p-8 text-center sm:p-10 lg:border-s lg:border-t-0 dark:bg-cream/10">
          {!commerce && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1 text-xs font-bold text-accent-foreground shadow-e1">
              {t.plans.soonBadge}
            </span>
          )}
          <div>
            <p className="text-sm text-muted-foreground">{t.plans.from}</p>
            <p className="mt-1 flex items-baseline justify-center gap-1.5">
              <span className="font-display text-5xl font-semibold tabular">{fromPrice}</span>
              <span className="text-sm text-muted-foreground">SAR {t.plans.month}</span>
            </p>
          </div>
          <Link href="/register" className="w-full max-w-60">
            <Button size="lg" className="w-full">
              {t.plans.cta} <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          </Link>
          {/* The billing shape, said plainly before any ask (R021/R006):
              upfront term, pause/cancel free, never an automatic renewal. */}
          <p className="max-w-64 text-xs leading-relaxed text-muted-foreground">{t.plans.billingNote}</p>
          {!commerce && (
            <p className="max-w-64 text-xs leading-relaxed text-muted-foreground">{t.plans.soonNote}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Member voices ──────────────────────────────────────────────────────── */

const VOICE_TONES: Tone[] = ["green", "orange", "pink"];

function MemberVoices({ isAr, title }: { isAr: boolean; title: string }) {
  const { data } = useQuery({ queryKey: ["testimonials"], queryFn: () => api.testimonials() });
  // Honest by default (R006): a subscription testimonial ("food arrives before we
  // run out", "the plan paid for itself") is impossible before a single box ships.
  // We never present invented members as social proof — the voices section stays
  // dark until memberships are live and testimonials are real. Pre-launch trust is
  // carried by the live community (real cats, real members) instead.
  if (!commerceEnabled()) return null;
  if (!data || data.length === 0) return null;
  return (
    <section className="container py-20 sm:py-24">
      <h2 className="mb-14 text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      <div className="grid gap-10 md:grid-cols-3 md:gap-6 lg:gap-10">
        {data.slice(0, 3).map((tst, i) => {
          const tone = VOICE_TONES[i % VOICE_TONES.length];
          return (
            <motion.figure
              key={tst.id}
              variants={fadeUp} initial="hidden" whileInView="show"
              viewport={{ once: true, margin: "-60px" }} custom={i}
            >
              {/* Speech bubble */}
              <div className="relative rounded-[1.75rem] border border-border bg-card p-6 shadow-e1">
                <div className="mb-3 flex gap-0.5" aria-label={`${tst.rating} / 5`}>
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className={`size-4 ${s < tst.rating ? "fill-accent text-accent" : "text-muted"}`} />
                  ))}
                </div>
                <blockquote className="text-[15px] leading-relaxed">“{isAr ? tst.quoteAr : tst.quoteEn}”</blockquote>
                {/* the bubble's tail */}
                <span aria-hidden className="absolute -bottom-2 start-9 size-4 rotate-45 border-b border-e border-border bg-card" />
              </div>
              <figcaption className="mt-5 flex items-center gap-3 ps-4">
                <IlloCat tone={tone} className="h-9 w-auto" />
                <span className="text-sm font-medium">
                  {tst.authorName}
                  {tst.role && <span className="font-normal text-muted-foreground"> · {tst.role}</span>}
                </span>
              </figcaption>
            </motion.figure>
          );
        })}
      </div>
    </section>
  );
}
