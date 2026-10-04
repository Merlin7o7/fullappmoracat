import type { Metadata } from "next";
import { cookies } from "next/headers";

// Section metadata for the community index. Individual public cat profiles at
// /community/[slug] set their own via generateMetadata (this is the fallback).
// One language per title — Arabic under ar (the default), English under en (R101).
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  return {
    title: isAr ? "مجتمع مرقط" : "Moracat community",
    description: isAr
      ? "قطط أهلها خلّوها ظاهرة في مجتمع مرقط — تصفّح ملفاتها وأعطها حبك."
      : "Cats whose people keep them visible in the Moracat community — browse their profiles and give them some love.",
    alternates: { canonical: "/community" },
  };
}

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
