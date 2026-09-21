import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";
import { cookies, headers } from "next/headers";
import { Providers } from "./providers";
import type { Locale } from "@/lib/i18n";
import { jsonLdProps } from "@/lib/json-ld";
import { BRAND, LEGAL_ENTITY, CONTACT } from "@/lib/org";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Deterministic mono for the "official layer" — Cat ID numbers, card microtype,
// data chips. Without it, `font-mono` fell to ui-monospace (the OS font), so the
// branded card — and its EXPORTS — rendered differently on every device.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});
// Display face: Fraunces — a warm, softly-inked serif with real character.
// Latin only; Arabic display stays Lyon via the [dir="rtl"] font stack.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "opsz"],
});

// Brand Arabic face — Lyon Arabic Display (licensed; provided by the brand).
// #10: Lyon is restricted to Arabic LETTER ranges only. Latin glyphs and BOTH
// digit blocks (Western U+0030–0039 and Arabic-Indic U+0660–0669 / U+06F0–06F9)
// fall outside this range, so they render in the clean sans (Inter) via the
// `var(--font-arabic), var(--font-sans)` stack — keeping numbers crisp while
// Arabic copy keeps its premium Lyon identity.
const arabic = localFont({
  src: "./fonts/lyon-arabic-display-regular.otf",
  variable: "--font-arabic",
  display: "swap",
  // No auto-generated metric fallback: next/font's adjusted face covers
  // U+0-10FFFF and would sit between Lyon and Inter in the RTL stack, so
  // Latin (IDs, SAR, "PDF") rendered in adjusted-Arial instead of Inter.
  // With it off, the unicode-range below keeps Lyon to Arabic letters and
  // everything else falls straight through to the clean sans.
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0600-065F, U+066A-06EF, U+06FA-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF",
    },
  ],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Locale-aware, because Arabic is the default experience (R101): an Arabic
 * visitor's tab title, search snippet and link preview must read in Arabic.
 * The layout already reads the locale cookie, so this adds no new dynamism.
 * Copy describes only what exists today — no delivery or partner promises
 * while commerce is off and the partner list is empty (R040).
 */
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  const title = isAr ? "مرقط — هوية لقطك، لحياته كلّها" : "Moracat — an ID for your cat, for their whole life";
  const description = isAr
    ? "سجّل قطك وخذ هويته باسمه ورقمه مجاناً: لو ضاع، اللي يلقاه يوصلك بدون ما ينكشف رقمك، وسجله الصحي معه في أي عيادة. ومعها التبنّي ومفقود وموجود ومجتمع أهل القطط في السعودية."
    : "Register your cat and get their Cat ID free: if they're ever lost, the finder reaches you without seeing your number, and their health record walks into any clinic with them. Plus adoption, Lost & Found and a community of Saudi cat people.";
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: isAr ? "%s · مرقط" : "%s · Moracat",
    },
    description,
    keywords: ["هوية قط", "مرقط", "قط مفقود", "تبني قطط", "سجل صحي للقطط", "Cat ID", "Moracat", "lost cat Saudi Arabia", "cat adoption Saudi Arabia"],
    openGraph: {
      type: "website",
      siteName: isAr ? BRAND.ar : BRAND.en,
      locale: isAr ? "ar_SA" : "en_US",
      title,
      description,
      url: siteUrl,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
    // Single-URL app with cookie-driven locale — advertise only the canonical URL.
    // (The former en-SA → /en alternate 404'd; a real localized route doesn't exist.)
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
    applicationName: BRAND.en,
    // The registered establishment that operates the brand.
    publisher: LEGAL_ENTITY.en,
    creator: LEGAL_ENTITY.en,
  };
}

export const viewport: Viewport = {
  // viewport-fit=cover lets the app paint into the notch/home-indicator area;
  // components then reclaim safe space with env(safe-area-inset-*) (see globals
  // .pb-safe / .bottom-safe). Without this, iOS letterboxes the app in white.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1712" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolve locale server-side from the cookie so the very first paint has the
  // correct lang/dir — English members never see a flash of Arabic RTL (R101/R102).
  // NOTE: reading cookies() here makes the app dynamically rendered (no static
  // marketing pages). That's an accepted trade for SSR-correct locale — the
  // marketing pages are already client-fetched, so TTFB impact is minimal;
  // revisit with a narrower boundary if CDN-cached static pages become a goal.
  const cookieLocale = cookies().get("locale")?.value;
  const locale: Locale = cookieLocale === "en" ? "en" : "ar";
  const dir = locale === "ar" ? "rtl" : "ltr";
  // The middleware's per-request nonce — next-themes' inline pre-paint script
  // must carry it or the strict CSP blocks it (dark mode would flash light).
  const nonce = headers().get("x-nonce") ?? undefined;

  // Organization structured data — names the legal entity behind the brand so
  // search/knowledge surfaces attribute Moracat to its operating establishment.
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.en,
    legalName: LEGAL_ENTITY.en,
    alternateName: [BRAND.ar, LEGAL_ENTITY.ar],
    url: siteUrl,
    logo: `${siteUrl}/opengraph-image`,
    email: CONTACT.supportEmail,
    telephone: CONTACT.phone,
    sameAs: [CONTACT.instagramUrl],
    // Honest geography (R006): delivery is kingdom-wide; founding partners start
    // in Jeddah & Riyadh. No region claim narrower than the real service area.
    areaServed: { "@type": "Country", name: "Saudi Arabia" },
    address: { "@type": "PostalAddress", addressCountry: "SA" },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: CONTACT.phone,
      contactType: "customer support",
      email: CONTACT.supportEmail,
      areaServed: "SA",
      availableLanguage: ["ar", "en"],
    },
  };

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`${inter.variable} ${fraunces.variable} ${arabic.variable} ${plexMono.variable} font-sans`}>
        <script {...jsonLdProps(orgJsonLd)} />
        {/* Skip link — keyboard users jump past the nav to content (R097). */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
        >
          {locale === "ar" ? "تخطَّ إلى المحتوى" : "Skip to content"}
        </a>
        <Providers initialLocale={locale} nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
