import type { Metadata } from "next";

// Invitation acceptance — personal, token-carrying, never indexed.
export const metadata: Metadata = {
  title: "Clinic invitation · دعوة العيادة",
  robots: { index: false, follow: false },
};

export default function VetInviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
