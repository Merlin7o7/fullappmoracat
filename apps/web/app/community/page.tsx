"use client";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CommunityBrowse } from "@/components/community-browse";

export default function CommunityPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="py-10 sm:py-14">
        <CommunityBrowse />
      </main>
      <SiteFooter />
    </div>
  );
}
