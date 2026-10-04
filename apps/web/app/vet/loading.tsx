import { LoadingState, Skeleton } from "@moraqat/ui";

/**
 * Route-level loading for the clinic portal (audit 2026-10-04 M7): plain
 * skeleton rows — no illustration, no motion beyond the shimmer (clinical
 * surfaces stay plain).
 */
export default function VetLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <Skeleton className="h-8 w-56" />
      <LoadingState rows={5} label="جارٍ التحميل · Loading" />
    </div>
  );
}
