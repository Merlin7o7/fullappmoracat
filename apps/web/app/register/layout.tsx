import type { Metadata } from "next";
import { cookies } from "next/headers";

// The census conversion page deserves a real search presence (client page →
// metadata on the layout). Copy claims only what the census already promises:
// free, no card, under two minutes (R006/R040).
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  const title = isAr ? "سجّل قطك — هوية مجانية خلال دقيقة" : "Register your cat — a free Cat ID in a minute";
  const description = isAr
    ? "اسم قطك، جنسه، عمره، وبريدك — وتصير هويته جاهزة. مجاناً، بدون كلمة مرور ولا بطاقة."
    : "Your cat's name, sex, age and your email — and their ID is ready. Free, no password, no card.";
  return {
    title,
    description,
    alternates: { canonical: "/register" },
    openGraph: { type: "website", title, description, url: "/register" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
