import type { Metadata } from "next";
import { cookies } from "next/headers";

// Section metadata for the feeding calculator (client page → title on the
// layout). One language per title (R101).
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  return {
    title: isAr ? "حاسبة التغذية" : "Feeding calculator",
    description: isAr
      ? "كم ياكل قطك؟ حاسبة السعرات اليومية مبنية على معادلات WSAVA (RER/MER)."
      : "How much should your cat eat? A daily calorie calculator built on the WSAVA RER/MER equations.",
    alternates: { canonical: "/tools/feeding" },
  };
}

export default function FeedingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
