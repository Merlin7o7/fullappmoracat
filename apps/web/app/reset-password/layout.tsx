import type { Metadata } from "next";
import { cookies } from "next/headers";

// App chrome — titled for the tab in the member's language (Arabic first,
// R101), never indexed (pairs with robots.ts Disallow).
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  return {
    title: isAr ? "كلمة مرور جديدة" : "Reset password",
    robots: { index: false, follow: false },
  };
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
