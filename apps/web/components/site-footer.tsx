"use client";

import Link from "next/link";
import { useLocale } from "@/app/providers";
import { IlloCat, IlloMouse, IlloPaw, IlloSprig } from "./illustrations";

/**
 * The site footer — a deep-green field with the brand's quietest joke:
 * a cat forever chasing a mouse along the top edge. Giant wordmark,
 * honest links, no newsletter begging.
 */
export function SiteFooter() {
  const { t, locale } = useLocale();
  const isAr = locale === "ar";

  const cols: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: isAr ? "العضوية" : "Membership",
      links: [
        { href: "/#how", label: t.nav.how },
        { href: "/#plans", label: t.nav.plans },
        { href: "/register", label: t.hero.cta },
      ],
    },
    {
      title: isAr ? "المتجر والأدوات" : "Shop & tools",
      links: [
        { href: "/products", label: t.nav.products },
        { href: "/tools/feeding", label: t.nav.tools },
        { href: "/blog", label: t.nav.blog },
      ],
    },
    {
      title: isAr ? "حسابك" : "Your account",
      links: [
        { href: "/login", label: t.nav.login },
        { href: "/portal", label: isAr ? "بوابة الأعضاء" : "Member portal" },
        { href: "/portal/support", label: isAr ? "الدعم" : "Support" },
      ],
    },
  ];

  return (
    <footer id="about" className="relative mt-24 overflow-hidden bg-primary text-primary-foreground">
      {/* The chase — runs the width of the footer, forever, slowly. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-1 h-14 select-none overflow-hidden" dir="ltr">
        <div className="animate-marquee flex w-max items-end gap-[46vw] pt-3 [animation-duration:52s]">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-end gap-14">
              <IlloMouse tone="peach" className="h-7 w-auto animate-bob" />
              <IlloCat tone="orange" className="h-11 w-auto animate-bob [animation-delay:0.15s]" />
            </div>
          ))}
        </div>
      </div>

      <div className="container pb-10 pt-24">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          {/* Brand block */}
          <div>
            <p className="font-display text-6xl font-semibold tracking-tight sm:text-7xl">
              {isAr ? "مرقط" : "Moracat"}
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-primary-foreground/70">
              {t.hero.subtitle}
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {cols.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/50">
                  {col.title}
                </h3>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link
                        href={l.href}
                        className="text-sm text-primary-foreground/80 transition-colors hover:text-primary-foreground"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Legal links — bilingual, no more 404s. */}
        <nav aria-label={isAr ? "روابط قانونية" : "Legal"} className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-primary-foreground/15 pt-6">
          {[
            { href: "/legal/privacy", label: isAr ? "الخصوصية" : "Privacy" },
            { href: "/legal/terms", label: isAr ? "الشروط" : "Terms" },
            { href: "/legal/cookies", label: isAr ? "ملفات الارتباط" : "Cookies" },
            { href: "/legal/community-guidelines", label: isAr ? "إرشادات المجتمع" : "Community Guidelines" },
            { href: "/legal/content-policy", label: isAr ? "سياسة المحتوى" : "Content Policy" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="text-xs text-primary-foreground/70 transition-colors hover:text-primary-foreground">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 pt-2 sm:flex-row">
          <p className="flex items-center gap-2 text-xs text-primary-foreground/60">
            <IlloPaw tone="peach" className="size-4" />
            {t.footerNote}
          </p>
          <p className="text-xs text-primary-foreground/50">{t.footer}</p>
        </div>
      </div>

      {/* Quiet sprig in the corner. */}
      <IlloSprig
        tone="peach"
        className="pointer-events-none absolute -bottom-6 end-6 h-28 w-auto rotate-12 opacity-20"
      />
    </footer>
  );
}
