import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/breadcrumbs";
import { CommunityProfileView } from "@/components/community-profile-view";
import type { CommunityProfile } from "@/lib/api";
import { jsonLdProps } from "@/lib/json-ld";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";

async function fetchCat(slug: string): Promise<CommunityProfile | null> {
  try {
    const res = await fetch(`${BASE}/api/community/cats/${slug}`, {
      // A short revalidate keeps public profiles fresh without hammering the API.
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as CommunityProfile;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const cat = await fetchCat(params.slug);
  if (!cat) return { title: "Moracat Community" };
  const title = `${cat.name} · Moracat`;
  const description = cat.bio || `${cat.name} — a member of the Moracat community.`;
  const url = `${SITE}/community/${params.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // No explicit og/twitter images here: the branded share card rendered by
    // ./opengraph-image.tsx (photo in a sticker frame + Cat ID number + tenure)
    // is the preview everywhere — a raw photo says "picture", the card says
    // "membership". File-convention metadata supplies both og and twitter images.
    openGraph: {
      title,
      description,
      type: "profile",
      url,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CommunityProfilePage({ params }: { params: { slug: string } }) {
  const cat = await fetchCat(params.slug);
  if (!cat) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Thing",
      name: cat.name,
      description: cat.bio || `${cat.name} — a member of the Moracat community.`,
      image: cat.photoUrl ?? undefined,
      url: `${SITE}/community/${params.slug}`,
    },
  };

  const isAr = cookies().get("locale")?.value !== "en";
  const crumbs = [
    { href: "/", label: isAr ? "الرئيسية" : "Home" },
    { href: "/community", label: isAr ? "المجتمع" : "Community" },
    { label: cat.name },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <script {...jsonLdProps(jsonLd)} />
      <script {...jsonLdProps(breadcrumbJsonLd(crumbs, SITE))} />
      {/* Same width as the profile view below, so the trail aligns with it. */}
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <Breadcrumbs items={crumbs} isAr={isAr} />
      </div>
      <CommunityProfileView cat={cat} slug={params.slug} />
      <SiteFooter />
    </div>
  );
}
