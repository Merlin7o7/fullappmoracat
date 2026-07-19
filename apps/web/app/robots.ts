import type { MetadataRoute } from "next";
import { commerceEnabled } from "@/lib/features";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";

export default function robots(): MetadataRoute.Robots {
  // While the Census runs there is nothing to sell, so the shop shouldn't be
  // crawled at all. Disallow alone can't stop a linked URL from being *listed*,
  // so /products also carries `robots: noindex` in its layout metadata — the
  // two together are what actually keep it out of results (R040).
  const commerceDisallow = commerceEnabled() ? [] : ["/products"];

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private surfaces should never be crawled.
      disallow: ["/portal", "/admin", "/reset-password", "/verify-email", ...commerceDisallow],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
