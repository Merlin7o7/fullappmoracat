import type { Metadata } from "next";
import { cookies } from "next/headers";

// Clinic-staff app chrome — titled for the tab, never indexed (pairs with the
// /vet Disallow in robots.ts).
// One language per title, in the reader's locale (Arabic by default) — the
// tab never reads as a bilingual label.
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  return {
    title: isAr ? "دخول العيادات" : "Clinic sign in",
    robots: { index: false, follow: false },
  };
}

export default function VetLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
