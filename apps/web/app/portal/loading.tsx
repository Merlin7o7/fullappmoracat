import { LoadingState, Skeleton } from "@moraqat/ui";

/**
 * Route-level loading for the portal (audit 2026-10-04 M7). The layout's
 * shell (rail, header, tab bar) stays put; only the content area shows
 * skeleton rows shaped like what is coming — no full-screen spinner (R119).
 */
export default function PortalLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Skeleton className="h-8 w-48" />
      <LoadingState rows={4} label="لحظة… · Loading" />
    </div>
  );
}
