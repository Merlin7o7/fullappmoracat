import type { Metadata } from "next";

// App chrome — titled for the tab, never indexed (pairs with robots.ts Disallow).
export const metadata: Metadata = {
  title: "Verify email · تأكيد البريد",
  robots: { index: false, follow: false },
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
