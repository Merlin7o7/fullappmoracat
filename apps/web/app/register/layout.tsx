import type { Metadata } from "next";
import { cookies } from "next/headers";

// The census conversion page deserves a real search presence (client page →
// metadata on the layout). Copy claims only what the flow actually does:
// free, no card, no password, under two minutes — the ONE time promise used
// everywhere sign-up is described (R006/R040; audit 2026-10-04 P8).
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  const title = isAr ? "سجّل قطك — هوية قطك، في أقل من دقيقتين" : "Register your cat — their ID in under two minutes";
  const description = isAr
    ? "اسم قطك وبريدك — وتصير هويته جاهزة في أقل من دقيقتين. مجاناً، بدون كلمة مرور ولا بطاقة."
    : "Your cat's name and your email — and their ID is ready in under two minutes. Free, no password, no card.";
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
