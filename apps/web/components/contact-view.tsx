"use client";

import { Instagram, Phone, Mail, ShieldQuestion } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useLocale } from "@/app/providers";
import { BRAND, LEGAL_ENTITY, CONTACT } from "@/lib/org";

/**
 * Contact — a plain, trustworthy way to reach the people behind the brand.
 * Names the legal operating entity (Saudi consumer-trust expectation) and gives
 * real, tappable ways to get in touch. No form theatre; just honest channels.
 */
export function ContactView() {
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const channels = [
    {
      icon: Instagram,
      label: isAr ? "إنستقرام" : "Instagram",
      value: CONTACT.instagramHandle,
      href: CONTACT.instagramUrl,
      external: true,
    },
    {
      icon: Phone,
      label: isAr ? "الهاتف / واتساب" : "Phone / WhatsApp",
      value: CONTACT.phoneDisplay,
      href: CONTACT.telHref,
      ltr: true,
    },
    {
      icon: Mail,
      label: isAr ? "الدعم" : "Support",
      value: CONTACT.supportEmail,
      href: `mailto:${CONTACT.supportEmail}`,
      ltr: true,
    },
    {
      icon: ShieldQuestion,
      label: isAr ? "الخصوصية والبيانات" : "Privacy & data",
      value: CONTACT.privacyEmail,
      href: `mailto:${CONTACT.privacyEmail}`,
      ltr: true,
    },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-2xl px-4 py-12 outline-none sm:py-16">
        <header className="mb-8 border-b border-border pb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {isAr ? "تواصل معنا" : "Contact us"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAr
              ? `يسعدنا سماعك. تواصل مع فريق ${BRAND.ar} عبر أي من القنوات التالية.`
              : `We'd love to hear from you. Reach the ${BRAND.en} team through any of these channels.`}
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          {channels.map((c) => (
            <a
              key={c.label}
              href={c.href}
              {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="flex items-center gap-3 rounded-2xl border border-border p-4 transition-colors hover:border-primary hover:bg-muted/50"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <c.icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{c.label}</span>
                <span className="block truncate text-sm font-medium" dir={c.ltr ? "ltr" : undefined}>
                  {c.value}
                </span>
              </span>
            </a>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-muted/40 p-5 text-sm leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">{isAr ? "الجهة المشغّلة" : "Operated by"}</p>
          <p className="mt-1" dir={isAr ? "rtl" : "ltr"}>{isAr ? LEGAL_ENTITY.ar : LEGAL_ENTITY.en}</p>
          <p className="mt-1 text-xs">{isAr ? "المملكة العربية السعودية — جدة والرياض" : "Saudi Arabia — Jeddah & Riyadh"}</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
