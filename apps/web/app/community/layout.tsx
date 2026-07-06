import type { Metadata } from "next";

// Section metadata for the community index. Individual public cat profiles at
// /community/[slug] set their own via generateMetadata (this is the fallback).
export const metadata: Metadata = {
  title: "Community · المجتمع",
  description:
    "Meet Moracat cats — discover public profiles, give love, and find the most-loved. تصفّح قطط مرقط.",
  alternates: { canonical: "/community" },
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
