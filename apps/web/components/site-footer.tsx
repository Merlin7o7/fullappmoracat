"use client";

import Link from "next/link";
import { Instagram, Phone } from "lucide-react";
import { useLocale } from "@/app/providers";
import { commerceEnabled } from "@/lib/features";
import { CONTACT, REGISTRATION, copyright } from "@/lib/org";
import { openConsentSettings } from "@/lib/track";
import { IlloCat, IlloMouse, IlloPaw, IlloSprig } from "./illustrations";

/**
 * The site footer — a deep-green field with the brand's quietest joke:
 * a cat chasing a mouse along the top edge. Giant wordmark, honest links,
 * no newsletter begging.
 *
 * The chase is a still frame now: AD 2.1 allows infinite loops only on the
 * homepage hero and loading states — "never in a footer" (audit 2026-10-04).
 * Every link is a 44px target on phones (audit M5: they were 21px).
 */
export function SiteFooter() {
  const { t, locale } = useLocale();
  const isAr = locale === "ar";

  // Community Mode: the homepage has no plans section and the shop sells
  // nothing, so neither link may appear — and the column that held the shop is
  // renamed to what it actually still offers (R040). Both restore on flip.
  const commerce = commerceEnabled();

  const cols: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: isAr ? "العضوية" : "Membership",
      links: [
        { href: "/about", label: isAr ? "ما هو مرقط؟" : "What is Moracat?" },
        { href: "/#how", label: t.nav.how },
        ...(commerce ? [{ href: "/#plans", label: t.nav.plans }] : []),
        { href: "/benefits", label: isAr ? "مزايا الأعضاء" : "Member benefits" },
        { href: "/register", label: t.hero.cta },
      ],
    },
    {
      title: commerce
        ? isAr ? "المتجر والأدوات" : "Shop & tools"
        : isAr ? "أدوات ومقالات" : "Tools & reading",
      links: [
        ...(commerce ? [{ href: "/products", label: t.nav.products }] : []),
        { href: "/tools/feeding", label: t.nav.tools },
        { href: "/blog", label: t.nav.blog },
        { href: "/vet-directory", label: isAr ? "دليل العيادات الموثّقة" : "Verified clinics" },
        { href: "/adopt", label: isAr ? "تبنَّ قطاً" : "Adopt a cat" },
        { href: "/lost-found", label: isAr ? "مفقود وموجود" : "Lost & Found" },
      ],
    },
    {
      title: isAr ? "حسابك" : "Your account",
      links: [
        { href: "/login", label: t.nav.login },
        { href: "/portal", label: isAr ? "بوابة الأعضاء" : "Member portal" },
        { href: "/contact", label: isAr ? "تواصل معنا" : "Contact us" },
        // The clinics' door — partnerships are by invitation (MRC-VET-002), so
        // this explains how clinics join and who to write to, not a form.
        { href: "/vet/apply", label: isAr ? "للعيادات" : "For clinics" },
      ],
    },
  ];

  return (
    <footer className="relative mt-12 overflow-hidden bg-primary text-primary-foreground sm:mt-24">
      {/* The chase — one frame of it, held still along the top edge. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-1 h-14 select-none overflow-hidden" dir="ltr">
        <div className="container flex items-end gap-14 pt-3">
          <IlloMouse tone="peach" className="h-7 w-auto" />
          <IlloCat tone="orange" className="h-11 w-auto" />
        </div>
      </div>

      <div className="container pb-8 pt-20 sm:pb-10 sm:pt-24">
        <div className="grid gap-8 sm:gap-12 lg:grid-cols-[1.2fr_2fr]">
          {/* Brand block */}
          <div>
            <p className="font-display text-5xl font-semibold tracking-tight sm:text-7xl">
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
                className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-primary-foreground/85 transition-colors hover:text-primary-foreground sm:min-h-0"
              >
                <Instagram className="size-4" /> {CONTACT.instagramHandle}
              </a>
              <a
                href={CONTACT.telHref}
                dir="ltr"
                className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-primary-foreground/85 transition-colors hover:text-primary-foreground sm:min-h-0"
              >
                <Phone className="size-4" /> {CONTACT.phoneDisplay}
              </a>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 sm:gap-8">
            {cols.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/85 sm:mb-4">
                  {col.title}
                </h3>
                <ul className="sm:space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link
                        href={l.href}
                        className="inline-flex min-h-11 items-center text-sm text-primary-foreground/80 transition-colors hover:text-primary-foreground sm:min-h-0"
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
        <nav aria-label={isAr ? "روابط قانونية" : "Legal"} className="mt-12 flex flex-wrap gap-x-5 border-t border-primary-foreground/15 pt-6 sm:gap-y-2">
          {[
            { href: "/legal/privacy", label: isAr ? "الخصوصية" : "Privacy" },
            { href: "/legal/terms", label: isAr ? "الشروط" : "Terms" },
            { href: "/legal/cookies", label: isAr ? "ملفات الارتباط" : "Cookies" },
            { href: "/legal/community-guidelines", label: isAr ? "إرشادات المجتمع" : "Community Guidelines" },
            { href: "/legal/content-policy", label: isAr ? "سياسة المحتوى" : "Content Policy" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center text-xs text-primary-foreground/85 transition-colors hover:text-primary-foreground sm:min-h-0">
              {l.label}
            </Link>
          ))}
          {/* Change the measurement choice at any time — reopens the notice. */}
          <button
            type="button"
            onClick={openConsentSettings}
            className="inline-flex min-h-11 items-center text-xs text-primary-foreground/85 underline-offset-4 transition-colors hover:text-primary-foreground hover:underline sm:min-h-0"
          >
            {isAr ? "إعدادات القياس" : "Measurement settings"}
          </button>
        </nav>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 pt-2 sm:flex-row">
          <p className="flex items-center gap-2 text-xs text-primary-foreground/85">
            <IlloPaw tone="peach" className="size-4" />
            {t.footerNote}
          </p>
          <div className="text-center sm:text-end">
            {/* copyright() already names the legal entity — printing it again
                underneath read as a rendering bug. */}
            <p className="text-xs text-primary-foreground/85">{copyright(locale)}</p>
            {(REGISTRATION.crNumber || REGISTRATION.vatNumber) && (
              <p className="mt-0.5 text-xs text-primary-foreground/85">
                {REGISTRATION.crNumber && (
                  <span>
                    {isAr ? "سجل تجاري" : "CR"} <span dir="ltr" className="font-mono">{REGISTRATION.crNumber}</span>
                  </span>
                )}
                {REGISTRATION.crNumber && REGISTRATION.vatNumber && <span aria-hidden> · </span>}
                {REGISTRATION.vatNumber && (
                  <span>
                    {isAr ? "الرقم الضريبي" : "VAT"} <span dir="ltr" className="font-mono">{REGISTRATION.vatNumber}</span>
                  </span>
                )}
              </p>
            )}
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
