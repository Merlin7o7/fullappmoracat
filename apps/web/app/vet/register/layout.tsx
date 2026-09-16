import type { Metadata } from "next";

// Client page → metadata on the layout. Invitation-only and token-bearing, so
// never indexed.
export const metadata: Metadata = {
  title: "تسجيل العيادة · Clinic registration",
  robots: { index: false, follow: false },
};

export default function VetRegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
