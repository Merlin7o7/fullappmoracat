import type { Metadata } from "next";

// The census conversion page deserves a real search presence (client page →
// metadata on the layout). Copy claims only what the census already promises:
// free, no card, under two minutes (R006/R040).
export const metadata: Metadata = {
  title: "Register your cat — free Cat ID · سجّل قطك",
  description:
    "Register your cat in the Saudi Cat Census and they get an official Cat ID — free, no card needed, under two minutes. سجّل قطك في التعداد واحصل على هوية رسمية مجاناً خلال دقيقتين.",
  alternates: { canonical: "/register" },
  openGraph: {
    type: "website",
    title: "Register your cat — free Cat ID · سجّل قطك",
    description:
      "An official Cat ID with your cat's name and their own number — free, in under two minutes.",
    url: "/register",
  },
  twitter: {
    card: "summary_large_image",
    title: "Register your cat — free Cat ID · سجّل قطك",
    description:
      "An official Cat ID with your cat's name and their own number — free, in under two minutes.",
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
