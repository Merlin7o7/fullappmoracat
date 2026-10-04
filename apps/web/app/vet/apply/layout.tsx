import type { Metadata } from "next";
import { cookies } from "next/headers";

// Clinic partnerships are invitation-only (MRC-VET-002). This page explains
// that and names the contact; it is not a search landing page any more, so it
// is noindex and no longer allowed in robots.ts or listed in the sitemap (R040).
// One language per title, in the reader's locale (Arabic by default) — the
// tab never reads as a bilingual label.
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  const description = isAr
    ? "شراكات عيادات مرقط بالدعوة، وكل عيادة نختارها ونتحقق منها."
    : "Moracat clinic partnerships are by invitation — every clinic is chosen and verified.";
  return {
    title: isAr ? "شراكات العيادات" : "Clinic partnerships",
    description,
    alternates: { canonical: "/vet/apply" },
    robots: { index: false, follow: true },
  };
}

export default function VetApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
