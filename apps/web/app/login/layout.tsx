import type { Metadata } from "next";
import { cookies } from "next/headers";

// App chrome, not a landing page — titled for the browser tab in the member's
// language (Arabic first, R101), kept out of search results (noindex here +
// Disallow in robots.ts, belt and braces, R040).
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  return {
    title: isAr ? "ادخل لملف قطك" : "Sign in",
    robots: { index: false, follow: false },
  };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
