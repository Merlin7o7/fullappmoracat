"use client";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LostFoundView } from "@/components/lost-found-view";

/**
 * One lost or found cat. Client-rendered because what the page shows depends
 * on whether the viewer is the reporter — and the API, not the browser, is
 * what decides that.
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
