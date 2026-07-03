import { Logo } from "@/components/logo";

/** Branded route-level loading / splash state. */
export default function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <Logo className="h-14 animate-pulse-glow" priority />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-shimmer rounded-full bg-accent" />
        </div>
      </div>
    </div>
  );
}
