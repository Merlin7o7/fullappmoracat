"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@moraqat/ui";
import { activeTabKey, type PortalTab } from "./nav";

/**
 * The phone's four tabs — قططي · العناية · اكتشف · حسابي — in the thumb zone
 * (R100), ≥44px targets (R092), labelled (icons alone are guesses). No "More":
 * every destination lives inside one of the four, so there is nothing left to
 * hide. Sits above the iOS home indicator via `.bottom-safe`; the page
 * reserves room with `.pb-nav` on <main>.
 */
export function PortalMobileNav({ tabs, isAr }: { tabs: PortalTab[]; isAr: boolean }) {
  const pathname = usePathname();
  const active = activeTabKey(pathname);

  return (
    <nav
      aria-label={isAr ? "التنقل" : "Navigation"}
      className="ps-safe pe-safe fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] border-t border-border bg-background/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  on ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors",
                    on ? "bg-primary/12" : "bg-transparent"
                  )}
                >
                  <t.icon className="size-[19px]" strokeWidth={on ? 2.2 : 1.8} />
                </span>
                <span>{isAr ? t.ar : t.en}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
