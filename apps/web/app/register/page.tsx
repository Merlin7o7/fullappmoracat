"use client";

import { useLocale } from "@/app/providers";
import { SiteHeader } from "@/components/site-header";
import { StartFlow } from "@/components/start-flow";

/**
 * Sign-up is the cat's ID being made (W8): three questions about the cat,
 * then an email and its code — no password, no form wall. Everything else is
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
          {isAr ? "هوية قطك، خلال دقيقة" : "Your cat's ID, in a minute"}
        </h1>
        <StartFlow isAr={isAr} />
      </main>
    </div>
  );
}
