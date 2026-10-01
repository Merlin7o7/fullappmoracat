"use client";

import { Printer } from "lucide-react";

/** Prints the current document (health summary, certificate). */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
    >
      <Printer className="size-4" aria-hidden /> {label}
    </button>
  );
}
