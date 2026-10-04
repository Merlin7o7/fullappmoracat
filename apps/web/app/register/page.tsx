"use client";

import * as React from "react";
import { useLocale } from "@/app/providers";
import { SiteHeader } from "@/components/site-header";
import { StartFlow } from "@/components/start-flow";

/**
 * Sign-up is the cat's ID being made: the cat's name (and, if they like, a
 * photo), who to call if the cat is ever lost, then an email and its code —
 * no password, no form wall, under six inputs (R016). Everything else is
 * asked after the ceremony, inside the cat's profile.
 */
export default function RegisterPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="main" className="px-4 py-8 sm:py-14">
        <h1 className="mx-auto mb-6 max-w-md font-display text-4xl leading-tight">
          {isAr ? "هوية قطك، في أقل من دقيقتين" : "Your cat's ID, in under two minutes"}
        </h1>
        {/* StartFlow keeps its step in ?step= (so the phone's Back button walks
            the steps); reading search params needs a Suspense boundary. */}
        <React.Suspense fallback={<div className="mx-auto min-h-[420px] w-full max-w-md" aria-hidden />}>
          <StartFlow isAr={isAr} />
        </React.Suspense>
      </main>
    </div>
  );
}
