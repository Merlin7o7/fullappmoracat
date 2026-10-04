import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { CommunityProfile } from "@/lib/api";
import { ShareLanding } from "@/components/share-landing";

/**
 * /i/{slug}?ref=…&src=… — the landing every member share points at
 * (story · card · poster · moment). See components/share-landing.tsx.
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function fetchPublicCat(slug: string): Promise<CommunityProfile | null> {
  try {
    // The community endpoint IS the privacy contract: public, photo-bearing,
    // active, not hidden — anything else is a 404 and the page goes generic.
    const res = await fetch(`${BASE}/api/community/cats/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as CommunityProfile;
  } catch {
    return null;
  }
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const cat = await fetchPublicCat(params.slug);
  const isAr = cookies().get("locale")?.value !== "en";
  return {
    title: cat ? (isAr ? `هوية ${cat.name}` : `${cat.name}'s ID`) : isAr ? "هوية مرقط" : "Moracat ID",
    description: isAr ? "لكل قط رقم يخصّه في سجل مرقط. قطك وش رقمه؟" : "Every cat gets a number of its own in the Moracat register.",
    // A share landing, not a profile: the canonical public page is /community/{slug}.
    robots: { index: false, follow: true },
  };
}

export default async function ShareLandingPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const cat = await fetchPublicCat(params.slug);
  const isAr = cookies().get("locale")?.value !== "en";
  return <ShareLanding cat={cat} isAr={isAr} refCode={one(searchParams.ref)} src={one(searchParams.src)} />;
}
