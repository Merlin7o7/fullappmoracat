import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@moraqat/ui";
import type { Crumb } from "@/lib/breadcrumbs";

// The JSON-LD helper lives in lib (pure, unit-tested); re-exported here so
// pages import the trail and its markup from one place.
export { breadcrumbJsonLd, type Crumb } from "@/lib/breadcrumbs";

/**
 * Quiet breadcrumb trail for deep pages only (a post, a cat, a legal doc) —
 * shallow marketing pages don't need one. Server-compatible: no hooks, so it
 * can render inside async pages next to their JSON-LD. RTL mirrors the
 * chevron (R104); links keep ≥44px targets (R092) and visible focus (R097).
 */
export function Breadcrumbs({ items, isAr, className }: { items: Crumb[]; isAr: boolean; className?: string }) {
  return (
    <nav aria-label={isAr ? "مسار التنقل" : "Breadcrumb"} className={cn("text-sm text-muted-foreground", className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight aria-hidden className="size-3.5 shrink-0 opacity-60 rtl:rotate-180" />}
            {item.href ? (
              <Link
                href={item.href}
                className="inline-flex min-h-11 items-center rounded-md px-1 underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="inline-flex min-h-11 items-center px-1 font-medium text-foreground/80">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

