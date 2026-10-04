import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ShareLanding } from "@/components/share-landing";

/** /i?ref=…&src=… — a member share whose cat is private (or unknown): the generic invitation. */

export const metadata: Metadata = {
  title: "هوية مرقط",
  robots: { index: false, follow: true },
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export default function ShareInvitePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const isAr = cookies().get("locale")?.value !== "en";
  return <ShareLanding cat={null} isAr={isAr} refCode={one(searchParams.ref)} src={one(searchParams.src)} />;
}
