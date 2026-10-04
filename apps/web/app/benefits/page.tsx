import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, IdCard, BadgeCheck, Stethoscope, Scissors, ShoppingBag, Home, Sparkles, MapPin } from "lucide-react";
import { Button } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IlloPaw } from "@/components/illustrations";
import { Illo3D } from "@/components/illo-3d";
import { PARTNERS, CATEGORY_LABEL, partnerCategories, type PartnerCategory } from "@/lib/partners";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";

export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  const title = isAr ? "مزايا الأعضاء" : "Member benefits";
  // Honest about the partner list (R006/R040): no network is described until
  // one exists.
  const description =
    PARTNERS.length > 0
      ? isAr
        ? "سعر الأعضاء عند شركاء مرقط — عيادات وعناية ومتاجر مختارة بعناية. اعرض هوية قطك عند الشريك."
        : "Your member rate at Moracat's partners — hand-picked vets, grooming and pet retail. Show your cat's ID at the partner."
      : isAr
        ? "ما عندنا شركاء حالياً — أول ما يتأكد شريك يظهر هنا مع ميزته بالضبط. وهوية قطك مجانية من اليوم."
        : "No partners yet — the moment one is confirmed, it appears here with its exact benefit. Your cat's ID is free from today.";
  const url = `${SITE}/benefits`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title, description, url },
    twitter: { card: "summary_large_image", title, description },
  };
}

const CATEGORY_ICON: Record<PartnerCategory, typeof Stethoscope> = {
  VET: Stethoscope,
  GROOMING: Scissors,
  RETAIL: ShoppingBag,
  BOARDING: Home,
  OTHER: Sparkles,
};

export default function BenefitsPage() {
  const isAr = cookies().get("locale")?.value !== "en";
  const hasPartners = PARTNERS.length > 0;
  const categories = partnerCategories();

  const steps = [
    {
      icon: IdCard,
      title: isAr ? "سوِّ هوية قطك" : "Create your cat's ID",
      body: isAr ? "مجاناً، في أقل من دقيقتين — هويته في مرقط تصير جاهزة." : "Free, in under two minutes — their Moracat ID is ready.",
    },
    {
      icon: BadgeCheck,
      title: isAr ? "اعرضها عند الشريك" : "Show it at a partner",
      body: isAr ? "بيّن هوية قطك عند الشريك ليُطبَّق سعر الأعضاء." : "Present your cat's ID at the partner to apply your member rate.",
    },
    {
      icon: Sparkles,
      title: isAr ? "سعرك محفوظ" : "Your rate, honoured",
      body: isAr ? "سعر الأعضاء محفوظ لك — تقدير لعضويتك، مو قسيمة خصم." : "Your member rate is honoured — recognition of your membership, not a coupon.",
    },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="container max-w-5xl py-12 outline-none sm:py-16">
        {/* Hero — member rates framed as recognition, never coupon-shouting (R085). */}
        <section className="text-center">
          <p className="text-sm font-semibold text-primary">
            {isAr ? "مزايا الأعضاء" : "Member benefits"}
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {hasPartners
              ? isAr ? "عضويتك مُقدَّرة عند شركائنا" : "Your membership, recognised at our partners"
              : isAr ? "مزايا الأعضاء — نبنيها شريكاً شريكاً" : "Member benefits — built one partner at a time"}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {hasPartners
              ? isAr
                ? "اعرض هوية قطك عند شركائنا من العيادات والعناية والمتاجر، ويُطبَّق سعر الأعضاء — ونقول لك بصدق وين وصلنا."
                : "Show your cat's ID at our partner vets, groomers and shops and your member rate applies — and we'll always tell you honestly where we've reached."
              : isAr
                ? "ما عندنا شركاء حالياً، ونقولها بصراحة. أول ما يتأكد شريك — عيادة أو عناية أو متجر — يظهر هنا مع ميزته بالضبط."
                : "We don't have partners yet, and we'd rather say so. The moment one is confirmed — a vet, a groomer or a shop — it appears here with its exact benefit."}
          </p>
        </section>

        {/* How it works — shown only once a partner exists: describing a
            working network with zero partners is a claim we can't show (R040). */}
        {hasPartners && (
        <section className="mt-14 sm:mt-20">
          <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
            {steps.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-border bg-card p-6 shadow-e1">
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="size-5" />
                </span>
                <p className="mt-4 font-display text-lg font-semibold">
                  <span className="text-muted-foreground/60">{i + 1} · </span>
                  {s.title}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Partners — real signed partners, or an honest welcome while the first
            founding partners are being confirmed (R111, never a void; R006). */}
        <section className="mt-16 sm:mt-24">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {isAr ? "الشركاء" : "Partners"}
          </h2>

          {hasPartners ? (
            <div className="mt-8 space-y-10">
              {categories.map((cat) => {
                const CatIcon = CATEGORY_ICON[cat];
                const inCat = PARTNERS.filter((p) => p.category === cat);
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <CatIcon className="size-4" />
                      {isAr ? CATEGORY_LABEL[cat].ar : CATEGORY_LABEL[cat].en}
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {inCat.map((p) => (
                        <div key={p.slug} className="rounded-2xl border border-border bg-card p-5 shadow-e1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-display text-lg font-semibold">{isAr ? p.nameAr : p.nameEn}</p>
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="size-3.5" /> {isAr ? p.cityAr : p.cityEn}
                              </p>
                            </div>
                          </div>
                          <p className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                            {isAr ? p.benefitAr : p.benefitEn}
                          </p>
                          {(isAr ? p.noteAr : p.noteEn) && (
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{isAr ? p.noteAr : p.noteEn}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Honest, warm "coming" state — a welcome, not an empty grid (R111). */
            <div className="mt-8 flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center sm:p-14">
              <Illo3D name="cat" className="size-32" px={128} />
              <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
                {isAr
                  ? "ما فيه شركاء بعد. نختارهم بعناية — وأول ما يتأكد شريك، يظهر هنا مع الميزة اللي يقدّمها بالضبط."
                  : "No partners yet. We're choosing them carefully — the moment one is confirmed, it appears here with the exact benefit it offers."}
              </p>
            </div>
          )}

          {/* The verified-clinic directory exists today — a real, adjacent path
              for the reader who came here thinking about vet care (R006). */}
          <p className="mt-6 text-sm text-muted-foreground">
            <Stethoscope aria-hidden className="me-1.5 inline size-4 align-[-2px]" />
            {isAr ? "تبحث عن عيادة الآن؟ " : "Looking for a clinic today? "}
            <Link href="/vet-directory" className="font-medium text-primary underline-offset-4 hover:underline">
              {isAr ? "تصفّح دليل العيادات الموثّقة" : "Browse the verified clinic directory"}
            </Link>
          </p>
        </section>

        {/* Public CTA. */}
        <section className="mt-16 flex flex-col items-center gap-4 rounded-3xl border border-border bg-card p-8 text-center shadow-e1 sm:mt-24 sm:p-12">
          <IlloPaw tone="peach" className="size-8 rotate-[12deg]" />
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {isAr ? "هوية قطك مجانية من اليوم" : "Your cat's ID is free from today"}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {isAr ? "سجّل قطك مجاناً — في أقل من دقيقتين." : "Register your cat for free — in under two minutes."}
          </p>
          <Link href="/register">
            <Button size="lg" className="mt-1">
              {isAr ? "سجّل قطك" : "Register your cat"} <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
