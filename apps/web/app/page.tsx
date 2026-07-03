"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Fingerprint, HeartPulse, PiggyBank, RefreshCw, Check, Star, ArrowRight } from "lucide-react";
import { Button, Card, Badge } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { CatIdCard } from "@/components/cat-id-card";
import { Logo } from "@/components/logo";
import { useLocale } from "./providers";
import { PLANS } from "@/lib/plans";
import { api } from "@/lib/api";

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
  const { t, locale } = useLocale();
  const isAr = locale === "ar";
  const [catName, setCatName] = React.useState("");

  const featureIcons = [Fingerprint, HeartPulse, PiggyBank, RefreshCw];

  const rememberName = () => {
    if (catName.trim()) {
      try { sessionStorage.setItem("moraqat.pendingCatName", catName.trim()); } catch { /* ignore */ }
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* ── Hero · identity first (Dossier Stage 1 + §05) ────────────────── */}
      <section className="mesh-bg relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 start-1/4 size-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-40 end-10 size-80 rounded-full bg-accent/20 blur-3xl animate-float" />
        </div>

        <div className="container grid items-center gap-12 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Left · the promise */}
          <div className="text-center lg:text-start">
            <motion.div variants={fadeUp} initial="hidden" animate="show">
              <Badge variant="accent" className="mb-6 px-4 py-1.5 text-sm">
                <Fingerprint className="size-3.5" /> {t.hero.badge}
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp} initial="hidden" animate="show" custom={1}
              className="mx-auto max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:mx-0 lg:text-6xl"
            >
              {t.hero.title}{" "}
              <span className="text-gradient">{t.hero.titleAccent}</span>
            </motion.h1>

            <motion.p
              variants={fadeUp} initial="hidden" animate="show" custom={2}
              className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground lg:mx-0"
            >
              {t.hero.subtitle}
            </motion.p>

            {/* Cat's name first (R016) — a taste of belonging before any ask (R011/R017) */}
            <motion.form
              variants={fadeUp} initial="hidden" animate="show" custom={3}
              onSubmit={(e) => e.preventDefault()}
              className="mx-auto mt-8 max-w-md lg:mx-0"
            >
              <label htmlFor="hero-cat-name" className="mb-2 block text-sm font-medium text-foreground/80">
                {t.hero.namePrompt}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="hero-cat-name"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value.slice(0, 24))}
                  placeholder={t.hero.namePlaceholder}
                  className="h-13 flex-1 rounded-full border border-input bg-background px-5 text-base shadow-e1 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Link href="/register" onClick={rememberName}>
                  <Button size="lg" className="w-full sm:w-auto">
                    {t.hero.cta} <ArrowRight className="size-4 rtl:rotate-180" />
                  </Button>
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t.hero.trust}</p>
            </motion.form>
          </div>

          {/* Right · the artifact, updating live as they type */}
          <motion.div
            variants={fadeUp} initial="hidden" animate="show" custom={2}
            className="relative mx-auto w-full max-w-sm"
          >
            <div className="animate-float">
              <CatIdCard
                catName={catName.trim() || (isAr ? "قطك" : "Your cat")}
                catIdNumber={PREVIEW_ID}
                isAr={isAr}
                preview
                className="shadow-glow"
              />
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">{t.hero.previewNote}</p>
          </motion.div>
        </div>
      </section>

      {/* ── Membership pillars (Dossier §01 / §04) ───────────────────────── */}
      <section id="how" className="container py-16">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t.features.title}</h2>
          <p className="mt-3 text-muted-foreground">{t.features.lede}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {t.features.items.map((f, i) => {
            const Icon = featureIcons[i] ?? Fingerprint;
            return (
              <motion.div
                key={f.title}
                variants={fadeUp} initial="hidden" whileInView="show"
                viewport={{ once: true, margin: "-80px" }} custom={i}
              >
                <Card interactive className="h-full p-6">
                  <span className="mb-4 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-display text-base font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Membership tiers · transparent (R021/R023/R085) ──────────────── */}
      <section id="plans" className="container py-16">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t.plans.title}</h2>
          <p className="mt-3 text-muted-foreground">{t.plans.subtitle}</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => {
            const name = isAr ? plan.nameAr : plan.nameEn;
            const tagline = isAr ? plan.taglineAr : plan.taglineEn;
            const features = isAr ? plan.featuresAr : plan.featuresEn;
            return (
              <motion.div
                key={plan.tier}
                variants={fadeUp} initial="hidden" whileInView="show"
                viewport={{ once: true, margin: "-60px" }} custom={i}
              >
                <Card interactive className={`relative flex h-full flex-col p-6 ${plan.popular ? "ring-2 ring-primary shadow-glow" : ""}`}>
                  {plan.popular && (
                    <Badge className="absolute -top-3 start-6 bg-primary text-primary-foreground">{t.plans.popular}</Badge>
                  )}
                  <h3 className="font-display text-xl font-semibold">{name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold tabular">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">SAR {t.plans.month}</span>
                  </div>
                  <ul className="mt-6 flex flex-1 flex-col gap-3">
                    {features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" className="mt-6">
                    <Button className="w-full" variant={plan.popular ? "primary" : "outline"}>{t.plans.choose}</Button>
                  </Link>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Member voices · social proof (Dossier Stage 1 trust) ─────────── */}
      <MemberVoices isAr={isAr} title={t.voices.title} />

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer id="about" className="border-t border-border bg-secondary/30 py-14">
        <div className="container flex flex-col items-center gap-5 text-center">
          <Logo className="h-14" />
          <p className="max-w-md text-sm text-muted-foreground">{t.hero.subtitle}</p>
          <p className="text-xs text-muted-foreground">{t.footer}</p>
        </div>
      </footer>
    </div>
  );
}

function MemberVoices({ isAr, title }: { isAr: boolean; title: string }) {
  const { data } = useQuery({ queryKey: ["testimonials"], queryFn: () => api.testimonials() });
  if (!data || data.length === 0) return null;
  return (
    <section className="border-y border-border bg-secondary/40 py-16">
      <div className="container">
        <h2 className="mb-10 text-center font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {data.slice(0, 3).map((tst, i) => (
            <motion.div
              key={tst.id}
              variants={fadeUp} initial="hidden" whileInView="show"
              viewport={{ once: true, margin: "-60px" }} custom={i}
            >
              <Card className="flex h-full flex-col p-6">
                <div className="mb-3 flex gap-0.5" aria-label={`${tst.rating} / 5`}>
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className={`size-4 ${s < tst.rating ? "fill-accent text-accent" : "text-muted"}`} />
                  ))}
                </div>
                <p className="flex-1 text-[15px] leading-relaxed">“{isAr ? tst.quoteAr : tst.quoteEn}”</p>
                <p className="mt-4 text-sm font-medium">
                  {tst.authorName}
                  {tst.role && <span className="font-normal text-muted-foreground"> · {tst.role}</span>}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
