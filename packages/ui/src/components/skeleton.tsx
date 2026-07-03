import * as React from "react";
import { cn } from "../lib/cn";

/** Loading skeleton with shimmer (see .skeleton in globals.css). */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton h-4 w-full", className)} {...props} />;
}
