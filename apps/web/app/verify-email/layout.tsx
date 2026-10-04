import type { Metadata } from "next";
import { cookies } from "next/headers";

// App chrome — titled for the tab, never indexed (pairs with robots.ts
// Disallow). One language per title (R101).
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  return {
    title: isAr ? "تأكيد البريد" : "Verify email",
    robots: { index: false, follow: false },
  };
}

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
