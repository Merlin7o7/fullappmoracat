import * as React from "react";
import { cn } from "../lib/cn";

/** Hairline divider. */
export function Separator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" className={cn("h-px w-full bg-border", className)} {...props} />;
}

/** Accessible loading spinner. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-5 animate-spin text-muted-foreground", className)} viewBox="0 0 24 24" fill="none" role="status" aria-label="Loading">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
    </svg>
  );
}
