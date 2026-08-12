import type { Metadata } from "next";

// The clinics' public door (client page → metadata on the layout). The only
// /vet route meant for search — robots.ts allows it while disallowing the rest.
export const metadata: Metadata = {
  title: "Join the clinic network · انضموا لشبكة العيادات",
  description:
    "Run a veterinary clinic in Saudi Arabia? Apply to join the Moracat network and be listed as a verified clinic. عندك عيادة بيطرية؟ قدّم للانضمام لشبكة مرقط الموثّقة.",
  alternates: { canonical: "/vet/apply" },
  openGraph: {
    type: "website",
    title: "Join the Moracat clinic network · انضموا لشبكة العيادات",
    description:
      "Apply to join the Moracat network and be listed as a verified clinic in Saudi Arabia.",
    url: "/vet/apply",
  },
};

export default function VetApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
