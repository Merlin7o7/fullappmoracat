import type { MetadataRoute } from "next";
import { LEGAL_DOCS } from "@/lib/legal";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = ["", "/community", "/products", "/blog", "/tools/feeding", "/login", "/register"].map(
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

  return [...staticRoutes, ...legalRoutes];
}
