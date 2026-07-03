import { PawPrint } from "lucide-react";

/** Branded route-level loading state. */
export default function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary animate-pulse-glow">
          <PawPrint className="size-7 animate-float" />
        </span>
        <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-shimmer rounded-full bg-primary/60" />
        </div>
      </div>
    </div>
  );
}
