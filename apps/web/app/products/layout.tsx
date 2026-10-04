import type { Metadata } from "next";
import { cookies } from "next/headers";
import { commerceEnabled } from "@/lib/features";

// Per-section metadata (the page is a client component, so the title lives here
// on the server layout — every route inheriting the root template otherwise).
//
// The registration phase: the shop has nothing to sell, so it must not be
// indexed or described as a shop. robots.ts Disallow stops the crawl; this
// `noindex` stops the *listing* of a URL someone else linked to (the root layout
// sets index:true app-wide, so the opt-out has to be stated here). Both revert
// the moment NEXT_PUBLIC_COMMERCE_ENABLED flips (R040 — never advertise what we
// can't yet deliver). One language per title (R101).
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  return commerceEnabled()
    ? {
        title: isAr ? "المتجر" : "Shop",
        description: isAr ? "مستلزمات القطط في مرقط — أكل ورمل وعناية." : "Cat essentials from Moracat — food, litter and care picks.",
        alternates: { canonical: "/products" },
      }
    : {
        title: isAr ? "المتجر — لاحقاً" : "Shop — later",
        description: isAr
          ? "متجر مرقط ما فتح بعد — وهوية قطك مجانية من اليوم."
          : "Moracat's shop isn't open yet — your cat's ID is free from today.",
        alternates: { canonical: "/products" },
        robots: { index: false, follow: true },
      };
}

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
