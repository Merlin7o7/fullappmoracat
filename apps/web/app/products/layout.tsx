import type { Metadata } from "next";

// Per-section metadata (the page is a client component, so the title lives here
// on the server layout — every route inheriting the root template otherwise).
export const metadata: Metadata = {
  title: "Shop · المتجر",
  description:
    "Cat essentials for Moracat members — food, litter, and care picks. متجر مرقط لمستلزمات القطط.",
  alternates: { canonical: "/products" },
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
