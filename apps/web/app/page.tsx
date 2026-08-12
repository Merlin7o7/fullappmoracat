import { cookies } from "next/headers";
import { HomeView } from "@/components/home-view";
import { commerceEnabled } from "@/lib/features";
import { jsonLdProps } from "@/lib/json-ld";
import { getDict } from "@/lib/i18n";
import { BRAND } from "@/lib/org";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";

/**
 * The homepage — a thin server shell whose one job is structured data.
 * The interactive page lives in components/home-view.tsx; here we emit
 * FAQPage JSON-LD built from the *same* dict the visible FAQ renders (rich
 * results require the markup to match the page, so both read one source and
 * the same locale cookie), plus the site-level WebSite node. All JSON-LD goes
 * through jsonLdProps (lib/json-ld.ts) — never raw JSON.stringify.
 */
export default function HomePage() {
  const locale = cookies().get("locale")?.value === "en" ? "en" : "ar";
  const t = getDict(locale);

  // Same gating as the visible FAQ in HomeView: commerce questions must never
  // appear — in HTML or in markup — while the Census runs (R040/R006).
  const faqItems = [...t.faq.items, ...(commerceEnabled() ? t.faq.commerceItems : [])];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  // No SearchAction — the site has no search box (R006: claim only what exists).
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND.en,
    alternateName: BRAND.ar,
    url: SITE,
    inLanguage: ["ar", "en"],
  };

  return (
    <>
      <script {...jsonLdProps(faqJsonLd)} />
      <script {...jsonLdProps(websiteJsonLd)} />
      <HomeView />
    </>
  );
}
