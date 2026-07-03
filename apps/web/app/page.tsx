"use client";

import { motion } from "framer-motion";
import { PawPrint, Sparkles, Truck, ShieldCheck, Check, Brain } from "lucide-react";
import { Button, Card, Badge } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "./providers";
import { PLANS } from "@/lib/plans";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export default function HomePage() {
  const { t, locale } = useLocale();

  const features =
    locale === "ar"
      ? [
          { icon: Brain, title: "تغذية ذكية", body: "كميات محسوبة حسب وزن قطك وعمره وسلالته وفق الإرشادات البيطرية." },
          { icon: Truck, title: "توصيل شهري", body: "يصل تلقائياً إلى بابك في جدة والرياض. أوقفه أو تخطَّه متى شئت." },
          { icon: Sparkles, title: "منتجات مختارة", body: "أفضل الماركات من الطعام والرمل والمكافآت بأسعار شفافة." },
          { icon: ShieldCheck, title: "دفع آمن", body: "مدى، آبل باي، تابي وتمارا. متوافق مع نظام حماية البيانات السعودي." },
        ]
      : [
          { icon: Brain, title: "Smart feeding", body: "Quantities sized to your cat's weight, age and breed using vet guidelines." },
          { icon: Truck, title: "Monthly delivery", body: "Arrives automatically in Jeddah & Riyadh. Pause or skip anytime." },
          { icon: Sparkles, title: "Curated products", body: "The best brands of food, litter and treats at transparent prices." },
          { icon: ShieldCheck, title: "Secure payments", body: "Mada, Apple Pay, Tabby & Tamara. Saudi PDPL compliant." },
        ];

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mesh-bg relative overflow-hidden">
        {/* Ambient gradient blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 start-1/4 size-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-32 end-10 size-80 rounded-full bg-accent/20 blur-3xl animate-float" />
        </div>

        <div className="container flex flex-col items-center py-20 text-center md:py-28">
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <Badge variant="accent" className="mb-6 px-4 py-1.5 text-sm">
              <PawPrint className="size-3.5" /> {t.hero.badge}
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={1}
            className="max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl"
          >
            {t.hero.title}{" "}
            <span className="bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">
              {t.hero.titleAccent}
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={2}
            className="mt-6 max-w-xl text-lg text-muted-foreground"
          >
            {t.hero.subtitle}
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={3}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Button size="lg">{t.hero.cta}</Button>
            <Button size="lg" variant="glass">
              {t.hero.ctaSecondary}
            </Button>
          </motion.div>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={4}
            className="mt-6 text-sm text-muted-foreground"
          >
            🐾 {locale === "ar" ? "أكثر من ٢٬٠٠٠ قط سعيد" : "2,000+ happy cats"} ·{" "}
            {locale === "ar" ? "جدة والرياض" : "Jeddah & Riyadh"}
          </motion.p>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="how" className="container py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              custom={i}
            >
              <Card interactive className="h-full p-6">
                <span className="mb-4 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </span>
                <h3 className="font-display text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Plans ───────────────────────────────────────────── */}
      <section id="plans" className="container py-16">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t.plans.title}</h2>
          <p className="mt-3 text-muted-foreground">{t.plans.subtitle}</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => {
            const name = locale === "ar" ? plan.nameAr : plan.nameEn;
            const tagline = locale === "ar" ? plan.taglineAr : plan.taglineEn;
            const features = locale === "ar" ? plan.featuresAr : plan.featuresEn;
            return (
              <motion.div
                key={plan.tier}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-60px" }}
                custom={i}
              >
                <Card
                  interactive
                  className={`relative flex h-full flex-col p-6 ${
                    plan.popular ? "ring-2 ring-primary shadow-glow" : ""
                  }`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 start-6 bg-primary text-primary-foreground">
                      {t.plans.popular}
                    </Badge>
                  )}
                  <h3 className="font-display text-xl font-semibold">{name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold">{plan.price}</span>
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
                  <Button className="mt-6 w-full" variant={plan.popular ? "primary" : "outline"}>
                    {t.plans.choose}
                  </Button>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer id="about" className="border-t border-border py-12">
        <div className="container flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
              <PawPrint className="size-4" />
            </span>
            {t.brand}
          </div>
          <p className="text-sm text-muted-foreground">{t.footer}</p>
        </div>
      </footer>
    </div>
  );
}
