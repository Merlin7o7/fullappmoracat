"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck, Heart, FileHeart } from "lucide-react";
import { Button } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AdoptionBrowse } from "@/components/adoption-browse";
import { IlloBadge } from "@/components/illo-panel";
import { Illo3D } from "@/components/illo-3d";
import { Sticker, IlloPaw } from "@/components/illustrations";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { catLifeApi } from "@/lib/cat-life-api";

/**
 * The adoption front door.
 *
 * The hero makes one argument and then gets out of the way: a cat adopted
 * through Moracat arrives with their identity and their medical history intact.
 * No counts are advertised unless they are real (R006) — the number shown is
 * the live number of cats actually waiting.
 */
export default function AdoptPage() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const facets = useQuery({ queryKey: ["adoption-facets"], queryFn: () => catLifeApi.adoptionFacets() });
  const waiting = facets.data?.total ?? 0;

  const promises = [
    {
      illo: "cat" as const,
      tone: "cream" as const,
      ar: "الهوية تنتقل معه",
      en: "The Cat ID travels",
      arBody: "نفس الرقم، نفس البطاقة — ما تتغيّر لأن البيت تغيّر.",
      enBody: "Same number, same card. It doesn't change because the home did.",
    },
    {
      illo: "heart" as const,
      tone: "blush" as const,
      ar: "سجله الصحي معه",
      en: "Their record comes too",
      arBody: "التطعيمات والوزن وملاحظات الطبيب — كلها تنتقل لصاحبه الجديد.",
      enBody: "Vaccinations, weights, vet notes — all of it goes to the new owner.",
    },
    {
      illo: "paw" as const,
      tone: "sage" as const,
      ar: "بياناتك محفوظة",
      en: "Your details stay yours",
      arBody: "الرسائل تمرّ عبر مرقط. ما نكشف بريدك ولا رقمك لأحد.",
      enBody: "Messages go through Moracat. We never publish your email or number.",
    },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="mesh-bg relative overflow-hidden border-b border-border/70">
          <div className="container relative py-12 text-center sm:py-16">
            <Sticker rotate={-8} className="start-8 top-10 hidden md:block">
              <IlloPaw tone="orange" className="size-8 opacity-70" />
            </Sticker>
            {/* The one 3D object on this screen — the hero tier, at size. */}
            <Illo3D name="cat" className="mx-auto mb-5 block size-28 motion-safe:animate-float" px={112} priority />
            <h1 className="mx-auto max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {isAr ? "قطط تدوّر بيتاً" : "Cats looking for a home"}
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
              {isAr
                ? "كل قط هنا يحمل هوية مرقط — وتنتقل معه هويته وسجله الصحي كاملاً لبيته الجديد."
                : "Every cat here holds a Moracat Cat ID — and it travels with them to their new home, record and all."}
            </p>
            {waiting > 0 && (
              <p className="mt-3 text-sm font-medium text-primary">
                {isAr ? `${waiting} قط ينتظر اليوم` : `${waiting} waiting today`}
              </p>
            )}
            <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Link href={user ? "/portal/adoption" : "/register"}>
                <Button size="lg" variant="brand">
                  <FileHeart className="size-4" aria-hidden />
                  {isAr ? "اعرض قطاً للتبني" : "List a cat for adoption"}
                </Button>
              </Link>
              <Link href="/lost-found">
                <Button size="lg" variant="outline">
                  {isAr ? "مفقود وموجود" : "Lost & Found"}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── The three promises ───────────────────────────────────────── */}
        <section className="container py-10 sm:py-12">
          <div className="grid gap-4 sm:grid-cols-3">
            {promises.map((p) => (
              <div key={p.en} className="flex items-start gap-3 rounded-3xl border border-border bg-card p-5">
                <IlloBadge name={p.illo} tone={p.tone} />
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold">{isAr ? p.ar : p.en}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{isAr ? p.arBody : p.enBody}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── The cats ─────────────────────────────────────────────────── */}
        <section className="pb-14">
          <div className="container mb-5 flex items-center gap-2">
            <Heart className="size-4 text-primary" aria-hidden />
            <h2 className="font-display text-xl font-bold tracking-tight">
              {isAr ? "من ينتظر بيتاً" : "Waiting for a home"}
            </h2>
          </div>
          <AdoptionBrowse />
        </section>

        {/* ── A quiet word on safety ───────────────────────────────────── */}
        <section className="border-t border-border/70 bg-muted/30 py-10">
          <div className="container flex max-w-3xl flex-col items-center gap-3 text-center">
            <ShieldCheck className="size-6 text-primary" aria-hidden />
            <h2 className="font-display text-lg font-semibold">{isAr ? "تبنَّ بأمان" : "Adopt safely"}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isAr
                ? "مرقط ما يبيع القطط ولا يأخذ عمولة. التقوا في مكان عام، شوفوا القط قبل، ولا تدفع شيئاً قبل ما تلتقون. لو شفت إعلاناً مريباً، بلّغنا."
                : "Moracat doesn't sell cats and takes no commission. Meet in a public place, meet the cat first, and don't send money before you do. If a listing looks wrong, tell us."}
            </p>
            <Link
              href="/contact"
              className="min-h-[44px] pt-2.5 text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {isAr ? "بلّغ عن إعلان" : "Report a listing"}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
