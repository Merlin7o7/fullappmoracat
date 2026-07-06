"use client";

import { CommunityBrowse } from "@/components/community-browse";

// Community *inside* the dashboard shell — the portal layout provides the nav
// dock, so it stays visible while browsing (unlike the top-level /community).
export default function PortalCommunityPage() {
  return <CommunityBrowse compact />;
}
