import type { Metadata } from "next";

// App chrome — titled for the tab, never indexed (pairs with robots.ts Disallow).
export const metadata: Metadata = {
  title: "Reset password · استعادة كلمة المرور",
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
