"use client";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useLocale } from "@/app/providers";
import type { LegalDoc } from "@/lib/legal";

export function LegalView({ doc }: { doc: LegalDoc }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const l = isAr ? "ar" : "en";
  const updated = new Date(doc.updated).toLocaleDateString(isAr ? "ar-SA" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <header className="mb-8 border-b border-border pb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{doc.title[l]}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{doc.intro[l]}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            {isAr ? "آخر تحديث: " : "Last updated: "}
            {updated}
          </p>
        </header>

        <div className="space-y-8">
          {doc.sections.map((s, i) => (
            <section key={i}>
              <h2 className="mb-2 font-display text-lg font-semibold">{s.heading[l]}</h2>
              <div className="space-y-2">
                {s.body[l].map((p, j) => (
                  <p key={j} className="text-sm leading-relaxed text-foreground/85">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
