"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CommunityBrowse } from "@/components/community-browse";
import { IlloCat, IlloHeart, Sticker } from "@/components/illustrations";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";

export default function CommunityPage() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        {/* Public teaser — the community as an invitation, not a wall (M11).
            No member counts until they're genuinely impressive (R006). */}
        <section className="mesh-bg relative overflow-hidden border-b border-border/70">
          <div className="container relative py-12 text-center sm:py-16">
            <Sticker rotate={-10} className="start-8 top-8 hidden md:block">
              <IlloHeart tone="pink" className="size-9 opacity-80" />
            </Sticker>
            <Sticker rotate={12} className="end-10 bottom-8 hidden md:block">
              <IlloCat tone="orange" className="h-14 w-auto opacity-80" />
            </Sticker>
            <h1 className="mx-auto max-w-xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {isAr ? "مجتمع مرقط — قطط بهوية" : "The Moracat community — cats with an identity"}
            </h1>
            <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">
              {isAr
                ? "تعرّف على قطط الأعضاء، وخلّ قطك واحد منهم."
                : "Meet the member cats — and give yours a place among them."}
            </p>
            {!user && (
              <Link href="/register" className="mt-7 inline-block">
                <Button size="lg">
                  {isAr ? "سوِّ هوية قطك ببلاش" : "Create your cat's free ID"}
                  <ArrowRight className="size-4 rtl:rotate-180" />
                </Button>
              </Link>
            )}
          </div>
        </section>
        <div className="py-10 sm:py-14">
          <CommunityBrowse />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
