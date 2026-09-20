"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Heart, Search, Sparkles, Users } from "lucide-react";
import { Button, Card, cn } from "@moraqat/ui";
import { IlloBadge } from "@/components/illo-panel";
import { Illo3D } from "@/components/illo-3d";
import { api } from "@/lib/api";
import { catLifeApi } from "@/lib/cat-life-api";

/**
 * The portal home for a member who told us they don't have a cat yet.
 *
 * WHY THIS EXISTS AT ALL
 * The dashboard is built around a Cat ID, so without one it read as a
 * cat-shaped hole with an "Add a cat" button in the middle of it — an error
 * state wearing a welcome's clothes. But someone who joined without a cat is
 * not a failed registration; they are usually a few weeks from adopting one,
 * and Moracat has three genuinely useful things for them today: the cats
 * looking for a home, the reunion board, and the census.
 *
 * So this is a real home, with real content, and the "register my first cat"
 * door sits inside it as the one clear action rather than as a nag (R005,
 * R111, R002). Nothing here pretends to be a membership benefit they don't
 * have (R006).
 */
export function ExploreHome({ isAr, firstName }: { isAr: boolean; firstName: string | null }) {
  // Real numbers or none. A "0 cats waiting" is a fine thing to show; an
  // invented one is not (R006).
  const adoption = useQuery({
    queryKey: ["adoption-facets"],
    queryFn: () => catLifeApi.adoptionFacets(),
    retry: false,
  });
  const lostFound = useQuery({
    queryKey: ["lf-facets"],
    queryFn: () => catLifeApi.lostFoundFacets(),
    retry: false,
  });
  const census = useQuery({ queryKey: ["census"], queryFn: () => api.census(), retry: false });

  const doors = [
    {
      href: "/adopt",
      illo: "heart" as const,
      tone: "blush" as const,
      icon: Heart,
      title: isAr ? "قطط تدوّر بيتاً" : "Cats looking for a home",
      body: isAr
        ? "كل واحد منهم يحمل هوية مرقط — وتنتقل معه هويته وسجله الصحي كاملاً لبيتك."
        : "Each one holds a Moracat Cat ID — and it comes to you with their whole health record.",
      count: adoption.data?.total,
      countLabel: isAr ? "ينتظرون" : "waiting",
    },
    {
      href: "/lost-found",
      illo: "paw" as const,
      tone: "sage" as const,
      icon: Search,
      title: isAr ? "مفقود وموجود" : "Lost & Found",
      body: isAr
        ? "لو لقيت قطاً في حيّك، تقدر تساعده يرجع لأهله — حتى لو ما عندك قط."
        : "If you find a cat in your neighbourhood, you can help them get home — no cat of your own required.",
      count: lostFound.data ? lostFound.data.lost + lostFound.data.found : undefined,
      countLabel: isAr ? "إعلان قائم" : "open notices",
    },
    {
      href: "/community",
      illo: "cat" as const,
      tone: "cream" as const,
      icon: Users,
      title: isAr ? "المجتمع" : "The community",
      body: isAr
        ? "تعرّف على قطط الأعضاء في كل مدن السعودية — وشوف كيف تكون الهوية."
        : "Meet member cats across Saudi Arabia — and see what a Cat ID actually looks like.",
      count: census.data?.registered,
      countLabel: isAr ? "قط في التعداد" : "cats counted",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── The welcome ──────────────────────────────────────────────────── */}
      <Card className="relative overflow-hidden">
        <div className="flex flex-col items-center gap-5 p-7 text-center sm:flex-row sm:items-center sm:text-start">
          <span className="relative grid size-32 shrink-0 place-items-center">
            <span aria-hidden className="absolute size-28 rounded-full bg-cream blur-2xl opacity-80" />
            <Illo3D name="cat" px={128} className="relative size-32 motion-safe:animate-float" priority />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              {firstName
                ? isAr
                  ? `حياك الله يا ${firstName} 👋`
                  : `Welcome, ${firstName} 👋`
                : isAr
                  ? "حياك الله في مرقط 👋"
                  : "Welcome to Moracat 👋"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {isAr
                ? "ما عندك قط بعد — ولا يهم. حسابك شغّال من الحين: تصفّح القطط اللي تدوّر بيتاً، وتابع التعداد، وساعد قطة ضايعة ترجع لأهلها. وأول ما يجيك قط، هويته تنطبع في أقل من دقيقتين."
                : "No cat yet — that's completely fine. Your account works from today: browse the cats looking for a home, follow the census, and help a lost cat get back. And the moment a cat does arrive, their Cat ID takes under two minutes."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Link href="/adopt">
                <Button size="sm" variant="brand">
                  <Heart className="size-4" aria-hidden />
                  {isAr ? "شوف من ينتظر بيتاً" : "See who's waiting"}
                </Button>
              </Link>
              <Link href="/portal/cats/new">
                <Button size="sm" variant="outline">
                  {isAr ? "عندي قط الحين" : "I have a cat now"}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* ── What's actually here for them today ──────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {doors.map((d) => (
          <Link key={d.href} href={d.href} className="group">
            <Card
              className={cn(
                "flex h-full flex-col gap-3 p-5 transition-transform duration-200",
                "group-hover:-translate-y-0.5"
              )}
            >
              <IlloBadge name={d.illo} tone={d.tone} />
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold">{d.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{d.body}</p>
              </div>
              {d.count != null && (
                <p className="text-xs font-medium text-primary">
                  {d.count.toLocaleString(isAr ? "ar-SA" : "en-GB")} {d.countLabel}
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>

      {/* ── The one clear action, kept warm rather than naggy ─────────────── */}
      <Card className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-display font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden />
            {isAr ? "متى ما جاك قط" : "Whenever your cat arrives"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? "هويته الرسمية باسمه ورقمه تنطبع في أقل من دقيقتين، مجاناً — ويدخل التعداد الوطني."
              : "Their official Cat ID — their name, their own number — takes under two minutes, free, and puts them in the national count."}
          </p>
        </div>
        <Link href="/portal/cats/new" className="shrink-0">
          <Button size="sm">{isAr ? "سجّل أول قط لي" : "Register my first cat"}</Button>
        </Link>
      </Card>
    </div>
  );
}
