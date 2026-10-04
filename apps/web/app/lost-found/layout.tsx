import type { Metadata } from "next";
import { cookies } from "next/headers";

/**
 * Lost & Found. The description says what the board is FOR, because someone
 * searching for it is usually searching in a hurry. One language per title —
 * Arabic under ar (the default), English under en (R101).
 */
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  return {
    title: isAr ? "مفقود وموجود" : "Lost & Found",
    description: isAr
      ? "بلّغ عن قط مفقود أو قط لقيته، وتواصل مع صاحبه بدون ما ينكشف رقم أحد."
      : "Report a lost cat, or a cat you've found — and reach the owner without exposing anyone's details.",
    alternates: { canonical: "/lost-found" },
  };
}

export default function LostFoundLayout({ children }: { children: React.ReactNode }) {
  return children;
}
