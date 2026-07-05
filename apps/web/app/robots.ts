import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private surfaces should never be crawled.
      disallow: ["/portal", "/admin", "/reset-password", "/verify-email"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
