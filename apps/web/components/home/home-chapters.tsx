"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Syringe, Scale, Stethoscope, Cake, Sparkles, ShieldCheck, EyeOff, Link2, ArrowLeft, MessageSquareHeart } from "lucide-react";
import { IdBand, Ledger, LedgerRow, Seal, StatusTag, cn } from "@moraqat/ui";
import { api } from "@/lib/api";
import { Illo3D, type Illo3DName } from "@/components/illo-3d";

/**
 * The homepage as a story, not a feature list (W8):
 *
 *   your cat → identity → care → health → life → the cats of Moracat
 *   → for clinics → what we promise
 *
 * Each chapter carries ONE of the founder's 3D objects (never two in view —
 * AD 2.1) beside a REAL product artifact rendered from the same components the
 * product uses, so the page shows what members actually get. Motion is a
 * single, short reveal per chapter and is off under reduced motion.
 */
export function HomeChapters({ isAr }: { isAr: boolean }) {
  const t = (ar: string, en: string) => (isAr ? ar : en);
  return (
    <div className="space-y-24 py-20 sm:space-y-32 sm:py-28">
      <Chapter
        n="01"
        illo="cat"
        kicker={t("الهوية", "Identity")}
        title={t("رقم يبقى له، مهما صار", "A number that stays theirs, whatever happens")}
        body={t(
          "هوية مرقط رقم دائم باسم قطك. على طوقه رمز يقرأه أي جوال: من يلقاه يوصل لك برسالة — دون أن يرى رقمك.",
          "A Moracat ID is a permanent number in your cat's name. A code on the collar any phone can read: whoever finds them reaches you with a message — without ever seeing your number."
        )}
        artifact={<ScanArtifact isAr={isAr} />}
      />
      <Chapter
        n="02"
        illo="heart"
        flip
        kicker={t("العناية", "Care")}
        title={t("يذكّرك قبل ما تتذكّر", "It remembers before you have to")}
        body={t(
          "التطعيمات من سجله، الوزن كل شهر، الفحص السنوي — قائمة واحدة لكل قطط البيت، ورسالة هادئة كل أسبوع إذا فيه شي.",
          "Vaccines from their record, a monthly weigh-in, the yearly check-up — one list for every cat in the home, and a calm note each week when something is due."
        )}
        artifact={<CareArtifact isAr={isAr} />}
      />
      <Chapter
        n="03"
        illo="leaf"
        kicker={t("الصحة", "Health")}
        title={t("سجله يمشي معه لأي عيادة", "Their record walks into any clinic")}
        body={t(
          "رابط واحد ترسله للطبيب: الحساسية، الأدوية، التطعيمات، الوزن — ملخص نظيف بلا حساب ولا تطبيق. ينتهي متى ما تبي.",
          "One link you send the vet: allergies, medication, vaccines, weight — a clean summary, no account, no app. It ends when you say."
        )}
        artifact={<SummaryArtifact isAr={isAr} />}
      />
      <Chapter
        n="04"
        illo="fish"
        flip
        kicker={t("الحياة", "Life")}
        title={t("ألبوم عائلي لقطّك", "A family album for your cat")}
        body={t(
          "من يوم ولادته، لأول تطعيم، لكل زيارة وكل وزن — ولو انتقل لبيت جديد، يروح معه سجله كامل برقمه نفسه.",
          "From the day they were born, to the first vaccine, every visit and every weigh-in — and if they ever move to a new home, the whole record goes with them, same number."
        )}
        artifact={<TimelineArtifact isAr={isAr} />}
      />

      <MemberCats isAr={isAr} />
      <ForClinics isAr={isAr} />
      <Promises isAr={isAr} />
    </div>
  );
}

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Chapter({
  n, illo, kicker, title, body, artifact, flip,
}: { n: string; illo: Illo3DName; kicker: string; title: string; body: string; artifact: React.ReactNode; flip?: boolean }) {
  return (
    <section className="container">
      <div className={cn("grid items-center gap-10 lg:grid-cols-2 lg:gap-16", flip && "lg:[&>*:first-child]:order-2")}>
        <Reveal className="space-y-5">
          <div className="flex items-center gap-4">
            <Illo3D name={illo} className="size-20 shrink-0" px={80} />
            <p className="text-sm text-muted-foreground">
              <span dir="ltr" className="font-mono">{n}</span> · {kicker}
            </p>
          </div>
          <h2 className="max-w-xl font-display text-4xl leading-tight sm:text-5xl">{title}</h2>
          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">{body}</p>
        </Reveal>
        <Reveal>{artifact}</Reveal>
      </div>
    </section>
  );
}

// ── Artifacts: the product, drawn with the product's own pieces ─────────────

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-e2">{children}</div>;
}

function ScanArtifact({ isAr }: { isAr: boolean }) {
  const t = (ar: string, en: string) => (isAr ? ar : en);
  return (
    <Frame>
      <IdBand tone="emerald" kind={t("هوية مرقط", "Moracat ID")} serial="MRC-••••-7YQ3" seal={<Seal label={t("مسجّل", "Registered")} className="border-white/40 text-white" />} />
      <div className="space-y-3 p-6 text-center">
        <p className="font-display text-4xl">{t("لولو", "Lulu")}</p>
        <p className="text-sm text-muted-foreground">{t("له بيت وسجل صحي", "Has a home and a health record")}</p>
        <div className="flex justify-center">
          <StatusTag tone="positive" icon={<Syringe className="size-3.5" aria-hidden />}>{t("التطعيمات محدّثة", "Vaccinations up to date")}</StatusTag>
        </div>
        <div className="flex h-11 items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground">
          <MessageSquareHeart className="size-4" aria-hidden /> {t("أرسل رسالة للمالك", "Message the owner")}
        </div>
        <p className="text-xs text-muted-foreground">{t("بيانات المالك لا تظهر هنا أبداً", "The owner's details never appear here")}</p>
      </div>
    </Frame>
  );
}

function CareArtifact({ isAr }: { isAr: boolean }) {
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const rows = [
    { icon: Syringe, title: t("التطعيم الثلاثي", "Core vaccine"), sub: t("لولو · 12 نوفمبر", "Lulu · 12 November"), tone: "attention" as const, state: t("مستحق", "Due") },
    { icon: Scale, title: t("وزن شهري", "Monthly weigh-in"), sub: t("زعتر · بعد 9 أيام", "Zaatar · in 9 days"), tone: "neutral" as const, state: t("قادم", "Upcoming") },
    { icon: Stethoscope, title: t("الفحص السنوي", "Yearly check-up"), sub: t("لولو · مارس", "Lulu · March"), tone: "neutral" as const, state: t("قادم", "Upcoming") },
  ];
  return (
    <Frame>
      <div className="border-b border-border px-5 py-3 text-sm font-medium">{t("هذا الأسبوع مع قططك", "This week with your cats")}</div>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.title} className="flex items-center gap-3 px-5 py-3.5">
            <span className="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground"><r.icon className="size-4" aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{r.title}</span>
              <span className="block text-xs text-muted-foreground">{r.sub}</span>
            </span>
            <StatusTag tone={r.tone}>{r.state}</StatusTag>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

function SummaryArtifact({ isAr }: { isAr: boolean }) {
  const t = (ar: string, en: string) => (isAr ? ar : en);
  return (
    <Frame>
      <IdBand kind={t("ملخص صحي · مرقط", "Health summary · Moracat")} serial="MRC-••••-7YQ3" seal={<Seal label={t("صادر من مرقط", "Issued by Moracat")} />} />
      <div className="px-5 py-1">
        <Ledger>
          <LedgerRow label={t("الحساسية", "Allergies")} value={t("الدجاج", "Chicken")} />
          <LedgerRow label={t("أدوية حالية", "Current medication")} value={t("لا شيء", "None")} />
          <LedgerRow label={t("التطعيمات", "Vaccinations")} value={<StatusTag tone="positive">{t("محدّثة", "Up to date")}</StatusTag>} />
          <LedgerRow label={t("الوزن", "Weight")} value={t("4.4 كغ", "4.4 kg")} />
        </Ledger>
      </div>
      <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <Link2 className="size-3.5" aria-hidden /> {t("رابط مؤقت · تشوف كل فتحة · توقفه بضغطة", "Temporary link · you see every view · end it in one tap")}
      </p>
    </Frame>
  );
}

function TimelineArtifact({ isAr }: { isAr: boolean }) {
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const items = [
    { icon: Stethoscope, title: t("زيارة عيادة", "Clinic visit"), when: t("سبتمبر 2026", "September 2026") },
    { icon: Syringe, title: t("أول تطعيم", "First vaccine"), when: t("مارس 2024", "March 2024") },
    { icon: Sparkles, title: t("انضمت إلى سجل مرقط", "Joined the Moracat register"), when: t("يناير 2024", "January 2024") },
    { icon: Cake, title: t("وُلدت لولو", "Lulu was born"), when: t("ديسمبر 2023", "December 2023") },
  ];
  return (
    <Frame>
      <ol className="relative space-y-5 border-s border-border p-6 ps-10">
        {items.map((i) => (
          <li key={i.title} className="relative">
            <span aria-hidden className="absolute -start-[2.2rem] top-0 grid size-7 place-items-center rounded-full border border-border bg-card text-muted-foreground">
              <i.icon className="size-3.5" />
            </span>
            <p className="font-medium">{i.title}</p>
            <p className="text-sm text-muted-foreground">{i.when}</p>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

// ── Real member cats (consented: only cats their owners made public) ───────

function MemberCats({ isAr }: { isAr: boolean }) {
  const q = useQuery({ queryKey: ["home-member-cats"], queryFn: () => api.community({ sort: "recent" }), staleTime: 5 * 60_000 });
  const cats = (q.data?.items ?? []).filter((c) => c.photoUrl).slice(0, 8);
  if (cats.length < 4) return null; // a thin strip says less than none
  return (
    <section className="container space-y-6">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{isAr ? "مجتمع مرقط" : "The Moracat community"}</p>
          <h2 className="font-display text-4xl sm:text-5xl">{isAr ? "قطط حقيقية، في بيوت حقيقية" : "Real cats, in real homes"}</h2>
        </div>
        <Link href="/community" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline">
          {isAr ? "شوف المجتمع" : "See the community"} <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
        </Link>
      </Reveal>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cats.map((c) => (
          <Link key={c.slug} href={`/community/${c.slug}`} className="group block">
            <div className="aspect-square overflow-hidden rounded-2xl bg-[hsl(var(--cream))]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.photoUrl!} alt={c.name} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" />
            </div>
            <p className="mt-2 truncate text-sm font-medium">{c.name}</p>
            {c.city && <p className="truncate text-xs text-muted-foreground">{isAr ? c.city.nameAr : c.city.nameEn}</p>}
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{isAr ? "تظهر هنا فقط القطط التي اختار أصحابها مشاركتها." : "Only cats whose owners chose to share them appear here."}</p>
    </section>
  );
}

function ForClinics({ isAr }: { isAr: boolean }) {
  const t = (ar: string, en: string) => (isAr ? ar : en);
  return (
    <section className="container">
      <Reveal className="grid gap-8 overflow-hidden rounded-2xl bg-primary p-8 text-primary-foreground sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-4">
          <p className="text-sm text-primary-foreground/75">{t("للعيادات البيطرية", "For veterinary clinics")}</p>
          <h2 className="max-w-2xl font-display text-4xl leading-tight sm:text-5xl">{t("القط يدخل عيادتك ومعه تاريخه", "The cat walks in with their history")}</h2>
          <p className="max-w-xl text-lg leading-relaxed text-primary-foreground/85">
            {t(
              "امسح الهوية، اقرأ الحساسية والتطعيمات في ثوانٍ، واكتب الزيارة في سجل يبقى مع القط — وكل ذلك بإذن صاحبه.",
              "Scan the ID, read allergies and vaccines in seconds, and write the visit into a record that stays with the cat — all with the owner's consent."
            )}
          </p>
        </div>
        <Link href="/vet-directory" className="inline-flex h-12 w-fit items-center rounded-md bg-card px-6 text-base font-medium text-foreground hover:bg-card/90">
          {t("العيادات في مرقط", "Clinics on Moracat")}
        </Link>
      </Reveal>
    </section>
  );
}

function Promises({ isAr }: { isAr: boolean }) {
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const items = [
    { icon: EyeOff, title: t("رقمك لا يظهر لأحد", "Your number is never shown"), body: t("من يلقى قطك يراسلك عبر مرقط — ما يشوف رقمك ولا اسمك الكامل.", "Whoever finds your cat messages you through Moracat — they never see your number or full name.") },
    { icon: ShieldCheck, title: t("العيادة تقرأ بإذنك", "Clinics read with your permission"), body: t("تختار ماذا تشوف كل عيادة، وتشوف سجلاً بكل من فتح ملف قطك.", "You choose what each clinic sees, and you can see everyone who opened your cat's file.") },
    { icon: Link2, title: t("كل مشاركة لها نهاية", "Every share has an end"), body: t("روابط الملخص الصحي مؤقتة، وتوقفها بضغطة.", "Health-summary links are temporary, and you end them with one tap.") },
  ];
  return (
    <section className="container space-y-8">
      <Reveal>
        <h2 className="max-w-2xl font-display text-4xl leading-tight sm:text-5xl">{t("وعود نقدر نثبتها", "Promises we can show you")}</h2>
      </Reveal>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((i) => (
          <Reveal key={i.title} className="space-y-3 rounded-2xl border border-border bg-card p-6">
            <span className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary"><i.icon className="size-5" aria-hidden /></span>
            <p className="font-medium">{i.title}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{i.body}</p>
          </Reveal>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {t("مرقط منصة خاصة تديرها شركة سعودية — ليست جهة حكومية. ", "Moracat is a private platform run by a Saudi company — not a government body. ")}
        <Link href="/about" className="underline underline-offset-4">{t("من نحن", "About us")}</Link>
      </p>
    </section>
  );
}
