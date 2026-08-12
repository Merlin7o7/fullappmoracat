import type { Metadata } from "next";

// App chrome, not a landing page — titled for the browser tab, kept out of
// search results (noindex here + Disallow in robots.ts, belt and braces, R040).
export const metadata: Metadata = {
  title: "Sign in · تسجيل الدخول",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
