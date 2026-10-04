import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CONTACT, LEGAL_ENTITY } from "@/lib/org";
import { ContactView } from "@/components/contact-view";

export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  // One language per title — Arabic under ar (the default), English under en (R101).
  const title = isAr ? "تواصل معنا" : "Contact";
  const description = isAr
    ? `تواصل مع فريق مرقط — إنستغرام ${CONTACT.instagramHandle}، هاتف ${CONTACT.phoneDisplay}، وبريد الدعم والخصوصية. تُشغَّل المنصة من قِبل ${LEGAL_ENTITY.ar}.`
    : `Reach the Moracat team — Instagram ${CONTACT.instagramHandle}, phone ${CONTACT.phoneDisplay}, and support & privacy email. Operated by ${LEGAL_ENTITY.en}.`;
  return {
    title,
    description,
    alternates: { canonical: "/contact" },
    openGraph: { type: "website", title, description, url: "/contact" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function ContactPage() {
  return <ContactView />;
}
