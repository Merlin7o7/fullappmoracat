import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CommunityProfileView } from "@/components/community-profile-view";
import type { CommunityProfile } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

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
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      images: cat.photoUrl ? [{ url: cat.photoUrl }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: cat.photoUrl ? [cat.photoUrl] : undefined },
  };
}

export default async function CommunityProfilePage({ params }: { params: { slug: string } }) {
  const cat = await fetchCat(params.slug);
  if (!cat) notFound();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <CommunityProfileView cat={cat} slug={params.slug} />
      <SiteFooter />
    </div>
  );
}
