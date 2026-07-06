import type { Metadata } from "next";

// Section metadata for the feeding calculator (client page → title on the layout).
export const metadata: Metadata = {
  title: "Feeding calculator · حاسبة التغذية",
  description:
    "How much should your cat eat? A vet-guideline (WSAVA RER/MER) daily calorie calculator. حاسبة السعرات اليومية لقطك.",
  alternates: { canonical: "/tools/feeding" },
};

export default function FeedingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
