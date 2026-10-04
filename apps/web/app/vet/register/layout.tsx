import type { Metadata } from "next";
import { cookies } from "next/headers";

// Client page → metadata on the layout. Invitation-only and token-bearing, so
// never indexed.
// One language per title, in the reader's locale (Arabic by default) — the
// tab never reads as a bilingual label.
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  return {
    title: isAr ? "تسجيل العيادة" : "Clinic registration",
    robots: { index: false, follow: false },
  };
}

export default function VetRegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
