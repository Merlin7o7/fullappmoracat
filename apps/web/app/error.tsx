"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@moraqat/ui";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mesh-bg grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="mb-6 grid size-16 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-8" />
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. You can try again — if it keeps happening, please contact support.
        </p>
        <Button size="lg" className="mt-7" onClick={reset}>
          <RotateCcw className="size-4" /> Try again
        </Button>
      </div>
    </div>
  );
}
