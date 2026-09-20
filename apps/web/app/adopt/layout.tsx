import type { Metadata } from "next";

/**
 * Adoption. The metadata leads with what makes Moracat's version different —
 * the Cat ID and the record travel with the cat — rather than with "listings",
 * because that is the reason to rehome here and the reason to adopt here.
 */
export const metadata: Metadata = {
  title: "Adopt a cat · تبنَّ قطاً",
  description:
    "Cats looking for a home in Saudi Arabia — each with a Moracat Cat ID and a health record that travels with them. قطط تدوّر بيتاً، وهويتها وسجلها ينتقلان معها.",
  alternates: { canonical: "/adopt" },
};

export default function AdoptLayout({ children }: { children: React.ReactNode }) {
  return children;
}
