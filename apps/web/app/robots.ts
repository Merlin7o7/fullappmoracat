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
      // The vet app surface is chrome for clinic staff. Clinic partnerships are
      // invitation-only since MRC-VET-002, so /vet/apply is no longer a search
      // landing page — it sits under the /vet disallow with everything else
      // (and carries meta-robots noindex on its layout).
      allow: ["/"],
      // Private and app-chrome surfaces should never be crawled. The public
      // auth doors additionally carry meta-robots noindex on their layouts —
      // belt and braces, since Disallow alone can't unlist a linked URL (R040).
      disallow: ["/portal", "/admin", "/login", "/reset-password", "/verify-email", "/vet", ...commerceDisallow],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
