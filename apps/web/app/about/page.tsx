import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import { Button } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MoracatStory } from "@/components/moracat-story";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";

export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  const title = isAr ? "ما هو مرقط؟" : "What is Moracat?";
  const description = isAr
    ? "مرقط عضوية لأصحاب القطط: هوية رسمية لكل قط، أساسيات شهرية، مزايا شركاء، ومجتمع. الهوية هي البداية، والعضوية تفتح القيمة الكاملة."
    : "Moracat is a membership for cat owners: an official Cat ID, monthly essentials, partner benefits, and community. The ID is the beginning — the membership unlocks the full value.";
  const url = `${SITE}/about`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title, description, url },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function AboutPage() {
  const isAr = cookies().get("locale")?.value !== "en";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="container max-w-5xl py-12 outline-none sm:py-16">
        <MoracatStory isAr={isAr} variant="page" />

        {/* Public CTA — invite the reader to begin the journey. */}
        <section className="mt-16 flex flex-col items-center gap-4 rounded-3xl border border-border bg-card p-8 text-center shadow-e1 sm:mt-24 sm:p-12">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {isAr ? "ابدأ رحلة قطك اليوم" : "Start your cat's journey today"}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {isAr ? "أنشئ هوية مرقط لقطك مجاناً — وكن من الأعضاء المؤسّسين." : "Create your cat's Moracat ID for free — and become a founding member."}
          </p>
          <Link href="/register">
            <Button size="lg" className="mt-1">
              {isAr ? "سوِّ هوية قطك" : "Create your cat's ID"} <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
