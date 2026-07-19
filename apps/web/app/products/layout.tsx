import type { Metadata } from "next";
import { commerceEnabled } from "@/lib/features";

// Per-section metadata (the page is a client component, so the title lives here
// on the server layout — every route inheriting the root template otherwise).
//
// Phase 0 — the Census: the shop has nothing to sell, so it must not be indexed
// or described as a shop. robots.ts Disallow stops the crawl; this `noindex`
// stops the *listing* of a URL someone else linked to (the root layout sets
// index:true app-wide, so the opt-out has to be stated here). Both revert the
// moment NEXT_PUBLIC_COMMERCE_ENABLED flips (R040 — never advertise what we
// can't yet deliver).
export const metadata: Metadata = commerceEnabled()
  ? {
      title: "Shop · المتجر",
      description:
        "Cat essentials for Moracat members — food, litter, and care picks. متجر مرقط لمستلزمات القطط.",
      alternates: { canonical: "/products" },
    }
  : {
      title: "Coming soon · قريباً",
      description:
        "Moracat's shop isn't open yet — register your cat's ID free in the meantime. متجر مرقط لم يفتح بعد.",
      alternates: { canonical: "/products" },
      robots: { index: false, follow: true },
    };

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
