import type { Metadata } from "next";

// Clinic-staff app chrome — titled for the tab, never indexed (pairs with the
// /vet Disallow in robots.ts).
export const metadata: Metadata = {
  title: "Clinic sign in · دخول العيادات",
  robots: { index: false, follow: false },
};

export default function VetLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
