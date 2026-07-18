"use client";

import Link from "next/link";
import { Instagram, Phone } from "lucide-react";
import { useLocale } from "@/app/providers";
import { CONTACT, LEGAL_ENTITY, copyright } from "@/lib/org";
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
        { href: "/about", label: isAr ? "ما هو مرقط؟" : "What is Moracat?" },
        { href: "/#how", label: t.nav.how },
        { href: "/#plans", label: t.nav.plans },
        { href: "/benefits", label: isAr ? "مزايا الأعضاء" : "Member benefits" },
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
        { href: "/contact", label: isAr ? "تواصل معنا" : "Contact us" },
      ],
    },
  ];

  return (
    <footer className="relative mt-24 overflow-hidden bg-primary text-primary-foreground">
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
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-primary-foreground/85">
              {t.hero.subtitle}
            </p>
            {/* Contact — reachable and clickable on mobile (tel:). */}
            <div className="mt-6 flex flex-col gap-2.5">
              <a
                href={CONTACT.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-2 text-sm text-primary-foreground/85 transition-colors hover:text-primary-foreground"
              >
                <Instagram className="size-4" /> {CONTACT.instagramHandle}
              </a>
              <a
                href={CONTACT.telHref}
                dir="ltr"
                className="inline-flex w-fit items-center gap-2 text-sm text-primary-foreground/85 transition-colors hover:text-primary-foreground"
              >
                <Phone className="size-4" /> {CONTACT.phoneDisplay}
              </a>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {cols.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/85">
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
            <Link key={l.href} href={l.href} className="text-xs text-primary-foreground/85 transition-colors hover:text-primary-foreground">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 pt-2 sm:flex-row">
          <p className="flex items-center gap-2 text-xs text-primary-foreground/85">
            <IlloPaw tone="peach" className="size-4" />
            {t.footerNote}
          </p>
          <div className="text-center sm:text-end">
            <p className="text-xs text-primary-foreground/85">{copyright(locale)}</p>
            <p className="mt-0.5 text-[11px] text-primary-foreground/85" dir={isAr ? "rtl" : "ltr"}>
              {isAr ? LEGAL_ENTITY.ar : LEGAL_ENTITY.en}
            </p>
          </div>
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
