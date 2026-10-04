import type { Metadata } from "next";
import { cookies } from "next/headers";

// Invitation acceptance — personal, token-carrying, never indexed.
// One language per title, in the reader's locale (Arabic by default) — the
// tab never reads as a bilingual label.
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  return {
    title: isAr ? "دعوة العيادة" : "Clinic invitation",
    robots: { index: false, follow: false },
  };
}

export default function VetInviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
