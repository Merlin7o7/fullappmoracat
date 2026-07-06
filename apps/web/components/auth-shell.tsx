"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLocale } from "@/app/providers";
import { Logo } from "./logo";
import { CatIdCard } from "./cat-id-card";
import { IlloCat, IlloHeart, IlloMouse, IlloPaw, IlloSprig, Sticker } from "./illustrations";

/**
 * Auth shell — a split stage. The brand side is a deep-green field where the
 * cat is (as always) the hero; the form side is clean warm paper with one
 * clear action (R005). On small screens the brand side folds away and the
 * form breathes alone.
 */
export function AuthShell({
  children, title, subtitle, previewCatName,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  isAr?: boolean;
  /** When the member arrives with a cat's name (from the hero), the brand side
   *  shows their ID taking shape instead of the generic cat (R016/R011). */
  previewCatName?: string | null;
}) {
  const { t, locale } = useLocale();
  const isAr = locale === "ar";

  return (
    <div className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
      {/* ── Brand side ── */}
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-primary-foreground/80 transition-colors hover:text-primary-foreground">
          <ArrowRight className="size-4 ltr:rotate-180" />
          {isAr ? "الرئيسية" : "Back home"}
        </Link>

        {/* The hero of the moment */}
        <div className="relative mx-auto w-full max-w-sm py-10">
          <Sticker rotate={-12} float className="-start-4 top-2">
            <IlloHeart tone="pink" className="size-9" />
          </Sticker>
          <Sticker rotate={10} float delay={0.7} className="-end-2 top-10">
            <IlloPaw tone="butter" className="size-10" />
          </Sticker>
          <Sticker rotate={8} className="-bottom-2 -end-6">
            <IlloMouse tone="peach" className="h-10 w-auto" />
          </Sticker>
          <Sticker rotate={-14} className="-start-8 bottom-6">
            <IlloSprig tone="peach" className="h-16 w-auto opacity-60" />
          </Sticker>

          {previewCatName ? (
            <CatIdCard catName={previewCatName} catIdNumber="MRC-····-····" isAr={isAr} preview className="mx-auto shadow-glow" />
          ) : (
            <IlloCat tone="peach" className="mx-auto h-52 w-auto" />
          )}

          <p className="mt-10 text-center font-display text-3xl font-semibold leading-snug tracking-tight">
            {previewCatName
              ? (isAr ? `هوية ${previewCatName} جاهزة تنطبع` : `${previewCatName}'s ID is ready to be stamped`)
              : `${t.hero.title} ${t.hero.titleAccent}`}
          </p>
          <p className="mt-3 text-center text-sm leading-relaxed text-primary-foreground/70">
            {t.hero.trust}
          </p>
        </div>

        <p className="flex items-center gap-2 text-xs text-primary-foreground/50">
          <IlloPaw tone="peach" className="size-4" />
          {t.footerNote}
        </p>
      </aside>

      {/* ── Form side ── */}
      <main id="main" tabIndex={-1} className="mesh-bg relative flex items-center justify-center px-4 py-12 outline-none sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" aria-label="Moracat" className="mb-8 inline-flex">
            <Logo className="h-10" priority />
          </Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mb-7 mt-2 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </div>

        <PawCorner />
      </main>
    </div>
  );
}

/** A quiet trail of paws in the corner of the form side. */
function PawCorner() {
  return (
    <div aria-hidden className="pointer-events-none absolute bottom-6 end-6 hidden gap-3 sm:flex">
      <IlloPaw tone="peach" className="size-5 rotate-[14deg] opacity-60" />
      <IlloPaw tone="butter" className="size-4 -translate-y-2 rotate-[4deg] opacity-50" />
      <IlloPaw tone="sage" className="size-3.5 -translate-y-4 rotate-[20deg] opacity-40" />
    </div>
  );
}
