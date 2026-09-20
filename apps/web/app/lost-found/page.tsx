"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, ShieldCheck } from "lucide-react";
import { Button } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LostFoundBrowse } from "@/components/lost-found-browse";
import { Illo3D } from "@/components/illo-3d";
import { Sticker, IlloPaw } from "@/components/illustrations";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { catLifeApi } from "@/lib/cat-life-api";

/**
 * The reunion board's front door.
 *
 * Tone matters more here than anywhere else in the product. Someone arriving
 * has usually just lost a cat, so the page is calm, the two actions are obvious
 * and equal, and there is no marketing above them (R081, R005). The only number
 * advertised is cats genuinely marked back home — earned, never estimated.
 */
export default function LostFoundPage() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const facets = useQuery({ queryKey: ["lf-facets"], queryFn: () => catLifeApi.lostFoundFacets() });
  const reunited = facets.data?.reunited ?? 0;

  /**
   * Where each door leads, carrying WHICH door it was.
   *
   * A signed-out visitor goes through registration first, so the kind has to
   * survive that round trip inside an ENCODED `next`, because the naive
   * `${href}?kind=LOST` produced
   * `/register?next=/portal/lost-found?kind=LOST`, where the second `?` is
   * just a character in the next value and the form never opened on arrival.
   */
  const reportHref = (kind: "LOST" | "FOUND") => {
    const target = `/portal/lost-found?kind=${kind}`;
    return user ? target : `/register?next=${encodeURIComponent(target)}`;
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="mesh-bg relative overflow-hidden border-b border-border/70">
          <div className="container relative py-12 text-center sm:py-16">
            <Sticker rotate={9} className="end-10 top-10 hidden md:block">
              <IlloPaw tone="green" className="size-8 opacity-70" />
            </Sticker>
            {/* One 3D object, at size: the cat everyone here is looking for. */}
            <Illo3D name="cat" className="mx-auto mb-5 block size-28" px={112} priority />
            <h1 className="mx-auto max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {isAr ? "مفقود وموجود" : "Lost & Found"}
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
              {isAr
                ? "لوحة واحدة لأهل القطط في السعودية — تنشر فيها قطك المفقود، أو القط اللي لقيته، وتوصل الرسالة بدون ما تكشف بياناتك."
                : "One board for cat people across Saudi Arabia — post a cat you've lost, or one you've found, and reach the other side without exposing anyone."}
            </p>
            {reunited > 0 && (
              <p className="mt-3 text-sm font-medium text-primary">
                {isAr ? `${reunited} قط رجع لأهله من هنا` : `${reunited} cats have made it home from here`}
              </p>
            )}

            {/* Two equal doors — neither is the "primary" one, because which
                one you need depends entirely on the worst day you're having. */}
            <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Link href={reportHref("LOST")}>
                <Button size="lg" variant="brand">
                  <Search className="size-4" aria-hidden />
                  {isAr ? "ضاع قطي" : "My cat is missing"}
                </Button>
              </Link>
              <Link href={reportHref("FOUND")}>
                <Button size="lg" variant="outline">
                  <MapPin className="size-4" aria-hidden />
                  {isAr ? "لقيت قطاً" : "I found a cat"}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-10 sm:py-14">
          <LostFoundBrowse />
        </section>

        {/* ── What Moracat adds — the chip line is the one that matters ── */}
        <section className="border-t border-border/70 bg-muted/30 py-10">
          <div className="container flex max-w-3xl flex-col items-center gap-3 text-center">
            <ShieldCheck className="size-6 text-primary" aria-hidden />
            <h2 className="font-display text-lg font-semibold">
              {isAr ? "لو القط عنده شريحة، نوصل أسرع" : "If the cat is chipped, this gets faster"}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isAr
                ? "أول ما تنشر قطاً لقيته ومعه رقم شريحة، نقارنه بالقطط المسجّلة عندنا — وإذا طابق تماماً، يوصل صاحبه إشعار فوراً. ما ننبّه أحداً على تخمين: التطابق لازم يكون تاماً."
                : "The moment you post a found cat with a microchip number, we check it against every registered Moracat cat — and on an exact match, the owner is notified immediately. We never raise a maybe: the match has to be exact."}
            </p>
            {!user && (
              <Link href="/register" className="mt-1">
                <Button size="sm" variant="outline">
                  {isAr ? "سجّل قطك مجاناً" : "Register your cat, free"}
                </Button>
              </Link>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
