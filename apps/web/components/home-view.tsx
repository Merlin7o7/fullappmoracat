"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CatIdCard } from "@/components/cat-id-card";
import { IlloCan, IlloFish, IlloHeart, IlloMouse, IlloPaw, IlloSprig, Sticker } from "@/components/illustrations";
import { Sparkles } from "@/components/home/sparkles";
import { Illo3D } from "@/components/illo-3d";
import { useLocale } from "@/app/providers";
import { PLANS } from "@/lib/plans";
import { commerceEnabled } from "@/lib/features";
import { localizeName } from "@/lib/translit";
import { CensusCounter, FoundingNote, useCensus } from "@/components/census-counter";
import { MobileRegisterCta } from "@/components/mobile-register-cta";
import { HomeChapters } from "@/components/home/home-chapters";
import { useCaptureSource } from "@/lib/source";
import { MarketingProvider } from "@/components/marketing";

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

export function HomeView() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const isAr = locale === "ar";
  const [catName, setCatName] = React.useState("");
  // A stand's QR/NFC tile may point here rather than straight at /register
  // (MRC-GTM-001 §2), so the `?src=stand-004` code is captured on this page too.
  useCaptureSource();
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

  // The marker underline sits on the LAST word only («كلّها» / "life"): one
  // clean stroke, never split across a line break (audit M6).
  const accent = t.hero.titleAccent;
  const cut = accent.lastIndexOf(" ");
  const accentHead = cut > 0 ? accent.slice(0, cut) : "";
  const accentTail = cut > 0 ? accent.slice(cut + 1) : accent;

  return (
    <MarketingProvider className="min-h-screen">
      <SiteHeader />

      {/* ── Hero · identity first (Dossier Stage 1 + §05) ──────────────────
           Mobile order (audit 2026-10-04 Problem 4): headline → the live card
           → the name + CTA pill → trust line → one sentence. All of it fits
           the first 844px screen with the measurement notice showing. From
           lg the same pieces sit in two columns: words left, card right. ── */}
      <section id="main" tabIndex={-1} className="mesh-bg-rich relative overflow-hidden outline-none">
        <Sparkles preset="edge" className="sm:hidden" />
        <Sparkles preset="hero" className="hidden sm:block" />
        <div className="container grid grid-cols-1 items-center gap-x-10 pb-10 pt-5 sm:pb-16 sm:pt-12 md:pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
          <motion.p
            variants={fadeUp} initial="hidden" animate="show"
            className="mb-5 hidden w-fit items-center gap-2 rounded-full border border-border bg-card/90 px-4 py-1.5 text-sm font-medium text-primary shadow-e1 backdrop-blur lg:col-start-1 lg:row-start-1 lg:inline-flex"
          >
            <IlloPaw tone="orange" className="size-4" />
            {t.hero.badge}
          </motion.p>

          {/* (1) The headline — two lines on a phone, balanced. */}
          <motion.h1
            variants={fadeUp} initial="hidden" animate="show" custom={1}
            className="mx-auto max-w-2xl text-balance text-center font-display text-[2.5rem] leading-[1.2] sm:text-6xl lg:col-start-1 lg:row-start-2 lg:mx-0 lg:text-start lg:text-7xl"
          >
            {t.hero.title} {accentHead}{accentHead ? " " : null}
            <span className="underline-marker whitespace-nowrap text-primary">{accentTail}</span>
          </motion.h1>

          {/* (2) The artifact, updating live as they type — ~70% of a phone's width. */}
          <motion.div
            variants={fadeUp} initial="hidden" animate="show" custom={2}
            className="relative mx-auto mt-5 w-[70vw] max-w-sm sm:mt-10 sm:w-full lg:col-start-2 lg:row-span-6 lg:row-start-1 lg:mt-0"
          >
            {/* Desktop only: the sticker sheet and one emerald/copper object.
                The pink plush cat is retired as the hero (audit Part 05). */}
            <Illo3D name="rosette" px={128} hero loop priority className="absolute -top-16 end-0 z-0 hidden size-28 motion-safe:animate-float lg:block" />
            <Sticker rotate={-14} float className="-start-10 -top-8 hidden lg:block" delay={0.4}>
              <IlloMouse tone="sage" className="h-12 w-auto rtl:-scale-x-100" />
            </Sticker>
            <Sticker rotate={16} float className="-bottom-9 -end-9 z-20 hidden lg:block" delay={0.9}>
              <IlloPaw tone="butter" className="size-14" />
            </Sticker>
            <Sticker rotate={-18} className="-bottom-12 -start-7 z-20 hidden lg:block">
              <IlloSprig tone="leaf" className="h-20 w-auto opacity-70" />
            </Sticker>
            <div className="relative z-10">
              <TiltCard>
                <CatIdCard
                  catName={catName.trim() || (isAr ? "قطك" : "Your cat")}
                  catIdNumber={PREVIEW_ID}
                  isAr={isAr}
                  preview
                  className="shadow-glow"
                />
              </TiltCard>
            </div>
            <p className="mt-4 hidden text-center text-xs text-muted-foreground lg:block">{t.hero.previewNote}</p>
          </motion.div>

          {/* (3) Cat's name first (R016) + the one action, in one 52px pill. */}
          <motion.form
            id="hero-register"
            variants={fadeUp} initial="hidden" animate="show" custom={3}
            onSubmit={submitName}
            className="mx-auto mt-6 w-full max-w-md sm:mt-9 lg:col-start-1 lg:row-start-4 lg:mx-0"
          >
            <label htmlFor="hero-cat-name" className="mb-2 block text-center text-sm font-medium text-foreground/80 lg:text-start">
              {t.hero.namePrompt}
            </label>
            <div className="flex h-13 items-center gap-1 rounded-full border border-input bg-card p-1 ps-5 shadow-e2 focus-within:ring-2 focus-within:ring-ring">
              <input
                id="hero-cat-name"
                value={catName}
                onChange={(e) => setCatName(e.target.value.slice(0, 24))}
                placeholder={t.hero.namePlaceholder}
                autoComplete="off"
                enterKeyHint="go"
                className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/80"
              />
              <Button type="submit" className="btn-shine h-11 shrink-0 rounded-full px-5">
                {t.hero.cta} <ArrowRight className="size-4 rtl:rotate-180" />
              </Button>
            </div>
            {/* (4) The trust line, right under the action. */}
            <p className="mt-3 text-center text-xs text-muted-foreground lg:text-start">{t.hero.trust}</p>
          </motion.form>

          {/* (5) One sentence — the rest of the promise opens the first chapter. */}
          <motion.div
            variants={fadeUp} initial="hidden" animate="show" custom={4}
            className="mx-auto mt-5 max-w-xl text-center lg:col-start-1 lg:row-start-3 lg:mx-0 lg:mt-6 lg:text-start"
          >
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{t.hero.subtitleShort}</p>
          </motion.div>

          <motion.div
            variants={fadeUp} initial="hidden" animate="show" custom={5}
            className="mx-auto mt-3 flex flex-col items-center gap-2 lg:col-start-1 lg:row-start-5 lg:mx-0 lg:mt-5 lg:items-start"
          >
            {/* The live count, desktop only: on a phone the census section
                carries the number once, at size (never twice). Real figure
                only; renders nothing until it has one (R040/R006). */}
            <CensusCounter isAr={isAr} t={t.census} className="hidden lg:inline-flex" />
            {/* Quiet secondary path for the unconvinced (R005: still one primary action). */}
            <Link
              href="/#how"
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.hero.ctaSecondary}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Benefits ribbon — the promises, on repeat ─────────────────────── */}
      <BenefitsRibbon items={[...t.marquee]} />

      {/* ── The story: your cat → identity → care → health → life (W8) ──── */}
      <HomeChapters isAr={isAr} intro={t.hero.subtitleRest} />

      {/* ── The Census (Phase 0) / the membership (at launch) ──────────────
           While commerce is off the site's job is to count cats, so this slot
           carries the census — the real number, the founding cohort, and an
           honest statement that nothing is for sale. When the switch flips,
           the membership panel returns in its place, unchanged. ────────── */}
      {commerceEnabled() ? (
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
      ) : (
        <CensusSection t={t} isAr={isAr} />
      )}


      {/* ── Quiet FAQ — the four questions that precede trust (R004/R021) ── */}
      <section aria-labelledby="faq-title" className="container pb-2 pt-12 sm:pb-4 sm:pt-24">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq-title" className="mb-6 text-center font-display text-3xl sm:mb-8 sm:text-4xl">
            {t.faq.title}
          </h2>
          <div className="divide-y divide-border overflow-hidden rounded-[2rem] border border-border bg-card shadow-e1">
            {/* Commerce questions join the list only when there is commerce —
                the FAQPage JSON-LD in app/page.tsx gates on the same flag, so
                markup and page always tell the same story (R040/R006). */}
            {[...t.faq.items, ...(commerceEnabled() ? t.faq.commerceItems : [])].map((item) => (
              <details key={item.q} className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-start sm:px-6 sm:py-4 font-medium transition-colors [&::-webkit-details-marker]:hidden hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  {item.q}
                  <span aria-hidden className="text-lg text-muted-foreground transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground sm:px-6 sm:pb-5">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing invitation ────────────────────────────────────────────── */}
      <section id="closing-invite" className="container py-12 sm:py-24">
        <div className="mesh-bg-rich relative overflow-hidden rounded-[2.5rem] border border-border bg-card px-6 py-10 text-center shadow-e2 sm:py-20">
          <Sparkles preset="panel" />
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
          <Illo3D name="heart" px={128} loop className="relative mx-auto mb-4 block size-20 motion-safe:animate-float sm:mb-6 sm:size-32" />

          <p className="mb-3 text-sm text-muted-foreground">{isAr ? "لِحياة قطّك كلّها" : "For your cat's whole life"}</p>
          <h2 className="mx-auto max-w-xl text-balance font-display text-3xl sm:text-5xl">
            {closingTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">{t.closing.sub}</p>
          <Link href="/register" className="mt-7 inline-block sm:mt-9">
            <Button size="xl" className="btn-shine rounded-full px-9">
              {t.hero.cta} <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          </Link>
        </div>
      </section>

      <SiteFooter />

      {/* Mobile thumb-zone register bar — appears once the hero CTA scrolls
          away, yields to the closing invitation and cookie notice (R100/R005). */}
      <MobileRegisterCta heroId="hero-register" closingId="closing-invite" />
    </MarketingProvider>
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
  const track = [...items, ...items];
  return (
    <>
      {/* The moving ribbon is decorative; its promises still exist for screen
          readers (R095) — a static, visually-hidden copy carries them. */}
      <ul className="sr-only">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div aria-hidden className="marquee-pause overflow-hidden border-y border-border/70 bg-cream py-4" dir="ltr">
        <div className="animate-marquee flex w-max items-center gap-10">
          {track.map((item, i) => (
            <span key={i} className="flex items-center gap-10">
              <span dir="auto" className="whitespace-nowrap font-display text-lg text-cream-foreground/90">
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

/* ── The Census section (Phase 0, MRC-GTM-001 §1) ────────────────────────
 * The slot the priced membership panel occupies at launch. Three beats, in
 * the order a stranger needs them: the real number, why the number matters
 * (founding cohort, honestly sequential), and what is *not* happening yet.
 * No price, no plan tier, no countdown — the last of those is the one the
 * brand refuses on principle (R006).
 */

function CensusSection({ t, isAr }: { t: ReturnType<typeof useLocale>["t"]; isAr: boolean }) {
  const { data } = useCensus();

  return (
    <section id="census" className="mesh-bg-rich relative overflow-hidden border-y border-border/70 bg-cream/60 py-12 sm:py-24">
      <Sparkles preset="panel" />
      <div className="container relative">
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-butter/70 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-foreground/75 dark:bg-butter/20">
            <IlloPaw tone="orange" className="size-4" />
            {t.census.eyebrow}
          </span>
          <h2 className="mt-4 text-balance font-display text-3xl font-semibold tracking-tight sm:mt-5 sm:text-5xl">
            {t.census.title}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-4 sm:text-lg">
            {t.census.body}
          </p>

          {/* The number, at the size the campaign deserves. */}
          <CensusCounter isAr={isAr} t={t.census} variant="strip" className="mt-8 sm:mt-12" />
        </motion.div>

        {/* Founding cohort — real cohort size, never a remaining-places clock. */}
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="relative mx-auto mt-8 max-w-2xl overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-e2 sm:mt-14 sm:p-10"
        >
          <Sticker rotate={-12} className="start-7 top-7 hidden sm:block">
            <IlloHeart tone="orange" className="size-8 opacity-80" />
          </Sticker>
          <Sticker rotate={13} className="end-8 top-9 hidden sm:block">
            <IlloSprig tone="leaf" className="h-14 w-auto opacity-70" />
          </Sticker>
          <FoundingNote data={data} isAr={isAr} t={t.census} />
        </motion.div>

        {/* What is NOT happening yet, said plainly and unprompted (R040). A
            visitor who came looking for a box should learn the truth here
            rather than by hitting a dead checkout. */}
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mx-auto mt-6 max-w-2xl rounded-[2rem] border border-dashed border-border bg-transparent p-6 text-center sm:mt-10 sm:p-10"
        >
          <h3 className="font-display text-xl font-semibold tracking-tight">{t.census.soonTitle}</h3>
          <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-muted-foreground">
            {t.census.soonBody}
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ── The membership panel — one plan, computed from the cat (D2) ────────── */

function MembershipPanel({ t }: { t: ReturnType<typeof useLocale>["t"] }) {
  const commerce = commerceEnabled();
  const isAr = useLocale().locale === "ar";
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
              <span className="text-sm text-muted-foreground">{isAr ? "ر.س" : "SAR"} {t.plans.month}</span>
            </p>
          </div>
          <Link href="/register" className="w-full max-w-60">
            <Button size="lg" className="btn-shine w-full rounded-full">
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

