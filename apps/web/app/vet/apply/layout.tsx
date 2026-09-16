import type { Metadata } from "next";

// Clinic partnerships are invitation-only (MRC-VET-002). This page explains
// that and names the contact; it is not a search landing page any more, so it
// is noindex and no longer allowed in robots.ts or listed in the sitemap (R040).
export const metadata: Metadata = {
  title: "Clinic partnerships · شراكات العيادات",
  description:
    "Moracat clinic partnerships are by invitation — every clinic is chosen and verified. شراكات عيادات مرقط بالدعوة، وكل عيادة نختارها ونتحقق منها.",
  alternates: { canonical: "/vet/apply" },
  robots: { index: false, follow: true },
};

export default function VetApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
