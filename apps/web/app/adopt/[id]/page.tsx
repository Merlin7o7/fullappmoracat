"use client";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AdoptionListingView } from "@/components/adoption-listing-view";

/**
 * One cat's adoption page. A client page because what a visitor may see
 * (their own enquiry, an unlocked contact detail) depends on who is signed in
 * — and the API, not the browser, decides that.
 */
export default function AdoptListingPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <AdoptionListingView id={params.id} />
      </main>
      <SiteFooter />
    </div>
  );
}
