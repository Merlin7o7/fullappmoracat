import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LostFoundView } from "@/components/lost-found-view";
import { fetchNoticeForShare, noticeShareText } from "@/lib/lost-found-share";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";

/**
 * A lost-cat link is posted into neighbourhood WhatsApp groups, and the preview
 * IS the poster: a bare URL gets scrolled past, a face and a district get a
 * second look. So the metadata is rendered on the server from the same public,
 * anonymous read the page itself uses — nothing here that a stranger opening
 * the link would not see (the reporter stays private either way).
 */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const notice = await fetchNoticeForShare(params.id);
  const isAr = cookies().get("locale")?.value !== "en";
  if (!notice) {
    return { title: isAr ? "مفقود وموجود · مرقط" : "Lost & Found · Moracat" };
  }
  const { title, description } = noticeShareText(notice, isAr);
  const url = `${SITE}/lost-found/${params.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // The image comes from ./opengraph-image.tsx (file convention supplies both
    // the og and twitter image).
    openGraph: { title, description, type: "article", url },
    twitter: { card: "summary_large_image", title, description },
    // A settled notice should fall out of search; an active one should be found.
    robots: notice.status === "ACTIVE" ? undefined : { index: false },
  };
}

/**
 * One lost or found cat. The view itself stays client-rendered because what it
 * shows depends on whether the viewer is the reporter — and the API, not the
 * browser, is what decides that.
 */
export default function LostFoundDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <LostFoundView id={params.id} />
      </main>
      <SiteFooter />
    </div>
  );
}
