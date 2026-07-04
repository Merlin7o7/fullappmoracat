import { IlloPaw } from "@/components/illustrations";

/** Purposeful, minimal route-level loading (R119) — a padding paw, a word. */
export default function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <IlloPaw tone="orange" className="size-12 animate-bob" />
        <p className="text-sm text-muted-foreground" lang="ar" dir="rtl">
          لحظة…
        </p>
      </div>
    </div>
  );
}
