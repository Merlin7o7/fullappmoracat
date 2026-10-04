import type { Metadata } from "next";
import { cookies } from "next/headers";

// Section metadata for the blog index (the [slug] page sets its own via
// generateMetadata, which overrides this for individual posts).
// One name everywhere (R087): the section is "المدونة / Journal" — in the nav,
// this metadata, and the page H1. One language per title (R101).
export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  return {
    title: isAr ? "المدونة" : "Journal",
    description: isAr
      ? "مقالات عن العناية بالقطط وصحتها، وقصص من مجتمع مرقط."
      : "Cat care, health, and stories from the Moracat community.",
    alternates: { canonical: "/blog" },
  };
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
