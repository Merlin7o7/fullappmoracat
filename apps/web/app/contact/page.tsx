import type { Metadata } from "next";
import { ContactView } from "@/components/contact-view";

export const metadata: Metadata = {
  title: "Contact · تواصل معنا",
  description:
    "Reach the Moracat team — Instagram @moracat.sa, phone +966 55 109 4814, and support & privacy email. Operated by Abdulrahman Mansour Alghamdi Trading Establishment.",
};

export default function ContactPage() {
  return <ContactView />;
}
