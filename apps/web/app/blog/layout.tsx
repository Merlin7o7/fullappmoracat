import type { Metadata } from "next";

// Section metadata for the blog index (the [slug] page sets its own via
// generateMetadata, which overrides this for individual posts).
export const metadata: Metadata = {
  title: "Journal · المجلة",
  description:
    "Cat care, health, and Moracat community stories. مقالات العناية بالقطط ومجتمع مرقط.",
  alternates: { canonical: "/blog" },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
