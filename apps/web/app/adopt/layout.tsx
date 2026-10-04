import type { Metadata } from "next";
import { cookies } from "next/headers";

/**
 * Adoption. The metadata leads with what makes Moracat's version different —
 * the Cat ID and the record travel with the cat — rather than with "listings",
 * because that is the reason to rehome here and the reason to adopt here.
 * One language per title — Arabic under ar (the default), English under en (R101).
 */
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  return {
    title: isAr ? "تبنَّ قطاً" : "Adopt a cat",
    description: isAr
      ? "قطط تدوّر بيتاً — وهوية كل قط وسجله الصحي ينتقلان معه للبيت الجديد."
      : "Cats looking for a home — each with a Moracat Cat ID and a health record that moves with them.",
    alternates: { canonical: "/adopt" },
  };
}

export default function AdoptLayout({ children }: { children: React.ReactNode }) {
  return children;
}
