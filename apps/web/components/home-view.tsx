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
import { IlloHeart, IlloPaw, IlloSprig, Sticker } from "@/components/illustrations";
import { Illo3D } from "@/components/illo-3d";
import { useLocale } from "@/app/providers";
import { PLANS } from "@/lib/plans";
import { commerceEnabled } from "@/lib/features";
import { localizeName } from "@/lib/translit";
import { CensusCounter, FoundingNote, useCensus } from "@/components/census-counter";
import { MobileRegisterCta } from "@/components/mobile-register-cta";
import { HomeChapters } from "@/components/home/home-chapters";
import { useCaptureSource } from "@/lib/source";

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

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* ── Hero · identity first (Dossier Stage 1 + §05) ────────────────── */}
      <section id="main" tabIndex={-1} className="relative overflow-hidden outline-none">
        <div className="container grid items-center gap-14 py-14 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          {/* Left · the promise */}
          <div className="relative text-center lg:text-start">
            <motion.p
              variants={fadeUp} initial="hidden" animate="show"
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-primary"
            >
              {t.hero.badge}
            </motion.p>

            <motion.h1
              variants={fadeUp} initial="hidden" animate="show" custom={1}
              className="mx-auto max-w-2xl font-display text-5xl leading-[1.1] sm:text-6xl lg:mx-0 lg:text-7xl"
            >
              {t.hero.title}{" "}
              {/* Wrap is allowed below sm — nowrap on a long Arabic accent
                  overflowed narrow phones (R094-adjacent: survive small widths). */}
              <span className="text-primary sm:whitespace-nowrap">{t.hero.titleAccent}</span>
            </motion.h1>

            <motion.p
              variants={fadeUp} initial="hidden" animate="show" custom={2}
              className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0"
            >
              {t.hero.subtitle}
            </motion.p>

            {/* Cat's name first (R016) — a taste of belonging before any ask (R011/R017) */}
            <motion.form
              id="hero-register"
              variants={fadeUp} initial="hidden" animate="show" custom={3}
              onSubmit={submitName}
              className="mx-auto mt-9 max-w-md lg:mx-0"
            >
              <label htmlFor="hero-cat-name" className="mb-2.5 block text-sm font-medium text-foreground/80">
                {t.hero.namePrompt}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0 sm:rounded-md sm:border sm:border-input sm:bg-card sm:p-1.5 sm:ps-4 sm:shadow-e1 sm:focus-within:ring-2 sm:focus-within:ring-ring">
                <input
                  id="hero-cat-name"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value.slice(0, 24))}
                  placeholder={t.hero.namePlaceholder}
                  className="h-13 flex-1 rounded-md border border-input bg-card px-4 text-base shadow-e1 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring sm:h-11 sm:border-0 sm:bg-transparent sm:px-0 sm:shadow-none sm:focus-visible:ring-0"
                />
                <Link href="/register" onClick={rememberName} className="sm:shrink-0">
                  <Button size="lg" className="w-full sm:h-11 sm:w-auto sm:px-6">
                    {t.hero.cta} <ArrowRight className="size-4 rtl:rotate-180" />
                  </Button>
                </Link>
              </div>
              <p className="mt-3.5 text-xs text-muted-foreground">{t.hero.trust}</p>
              {/* The live count sits with the action, not in a banner: the whole
                  proposition is "join a count that is really happening", so the
                  number belongs where the decision is made. Real figure only —
                  see components/census-counter.tsx (R040/R006). */}
              <CensusCounter
                isAr={isAr}
                t={t.census}
                className="mt-4"
              />
              {/* Quiet secondary path for the unconvinced (R005: still one primary action). */}
              <p className="mt-2.5 text-sm">
                <Link
                  href="/#census"
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

      </section>

      {/* ── The story: your cat → identity → care → health → life (W8) ──── */}
      <HomeChapters isAr={isAr} />

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
      <section aria-labelledby="faq-title" className="container pb-4 pt-20 sm:pt-24">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq-title" className="mb-8 text-center font-display text-4xl">
            {t.faq.title}
          </h2>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-e1">
            {/* Commerce questions join the list only when there is commerce —
                the FAQPage JSON-LD in app/page.tsx gates on the same flag, so
                markup and page always tell the same story (R040/R006). */}
            {[...t.faq.items, ...(commerceEnabled() ? t.faq.commerceItems : [])].map((item) => (
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
      <section id="closing-invite" className="container py-20 sm:py-24">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-16 text-center shadow-e2 sm:py-20">
          {/* One 3D object for the invitation — never two in view (AD 2.1). */}
          <Illo3D name="heart" px={112} className="mx-auto mb-6 block size-28" />

          <p className="mb-3 text-sm text-muted-foreground">{isAr ? "لِحياة قطّك كلّها" : "For your cat's whole life"}</p>
          <h2 className="mx-auto max-w-xl font-display text-4xl sm:text-5xl">
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

      {/* Mobile thumb-zone register bar — appears once the hero CTA scrolls
          away, yields to the closing invitation and cookie notice (R100/R005). */}
      <MobileRegisterCta heroId="hero-register" closingId="closing-invite" />
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
    <section id="census" className="border-y border-border/70 bg-cream/60 py-20 sm:py-24">
      <div className="container">
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-butter/70 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-foreground/75 dark:bg-butter/20">
            <IlloPaw tone="orange" className="size-4" />
            {t.census.eyebrow}
          </span>
          <h2 className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            {t.census.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {t.census.body}
          </p>

          {/* The number, at the size the campaign deserves. */}
          <CensusCounter isAr={isAr} t={t.census} variant="strip" className="mt-12" />
        </motion.div>

        {/* Founding cohort — real cohort size, never a remaining-places clock. */}
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="relative mx-auto mt-14 max-w-2xl overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-e1 sm:p-10"
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
          className="mx-auto mt-10 max-w-2xl rounded-2xl border border-dashed border-border bg-transparent p-8 text-center sm:p-10"
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
  const fromPrice = Math.min(...PLANS.map((p) => p.price));

  return (
    <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-e2">
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

