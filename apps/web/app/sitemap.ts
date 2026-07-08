import type { MetadataRoute } from "next";
import { LEGAL_DOCS } from "@/lib/legal";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// Revalidate hourly — new blog posts and public cats appear without a redeploy.
export const revalidate = 3600;

/** Best-effort fetch of a slug list; never let a down API break the sitemap. */
async function slugs(path: string, pick: (json: unknown) => string[]): Promise<string[]> {
  try {
    const res = await fetch(`${API}/api${path}`, { headers: { accept: "application/json" }, next: { revalidate } });
    if (!res.ok) return [];
    return pick(await res.json());
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes = ["", "/community", "/products", "/blog", "/tools/feeding", "/contact", "/login", "/register"].map(
    (path) => ({
      url: `${SITE}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })
  );

  const legalRoutes = LEGAL_DOCS.map((d) => ({
    url: `${SITE}/legal/${d.slug}`,
    lastModified: new Date(d.updated),
    changeFrequency: "yearly" as const,
    priority: 0.3,
  }));

  const [blogSlugs, catSlugs] = await Promise.all([
    slugs("/content/blog", (j) => ((j as { items?: { slug: string }[] }).items ?? []).map((p) => p.slug)),
    slugs("/community/cats?limit=200", (j) => ((j as { items?: { slug?: string }[] }).items ?? []).map((c) => c.slug).filter((s): s is string => !!s)),
  ]);

  const blogRoutes = blogSlugs.map((slug) => ({
    url: `${SITE}/blog/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  const communityRoutes = catSlugs.map((slug) => ({
    url: `${SITE}/community/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...legalRoutes, ...blogRoutes, ...communityRoutes];
}
