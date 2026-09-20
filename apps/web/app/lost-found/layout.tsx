import type { Metadata } from "next";

/**
 * Lost & Found. The description says what the board is FOR in both languages,
 * because someone searching for it is usually searching in a hurry.
 */
export const metadata: Metadata = {
  title: "Lost & Found · مفقود وموجود",
  description:
    "Report a lost cat, or a cat you've found, anywhere in Saudi Arabia — and reach the owner without exposing anyone's details. بلّغ عن قط مفقود أو قط لقيته.",
  alternates: { canonical: "/lost-found" },
};

export default function LostFoundLayout({ children }: { children: React.ReactNode }) {
  return children;
}
