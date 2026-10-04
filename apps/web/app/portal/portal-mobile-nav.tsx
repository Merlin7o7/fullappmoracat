"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomBar, BOTTOM_LAYER, cn } from "@moraqat/ui";
import { activeTabKey, type PortalTab } from "./nav";

/**
 * The phone's four tabs — قططي · العناية · اكتشف · حسابي — in the thumb zone
 * (R100), ≥44px targets (R092), labelled (icons alone are guesses). No "More":
 * every destination lives inside one of the four, so there is nothing left to
 * hide. It is the bottom layer of the one bottom stack (audit 2026-10-04 M2):
 * the cookie notice and toasts stack above it, never over it, and the page
 * reserves room with `.pb-nav` (reads --bottom-stack) on <main>.
 *
 * Hidden on checkout and subscribe: a tab bar under the price and the Pay
 * button competes with the one action and could cover it (R021).
 */
const NO_TABS = ["/portal/checkout", "/portal/subscribe"];
export function PortalMobileNav({ tabs, isAr }: { tabs: PortalTab[]; isAr: boolean }) {
  const pathname = usePathname();
  const active = activeTabKey(pathname);
  if (NO_TABS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;

  return (
    <BottomBar
      as="nav"
      layer={BOTTOM_LAYER.nav}
      aria-label={isAr ? "التنقل" : "Navigation"}
      className="ps-safe pe-safe pb-bar-0 border-t border-border bg-background/95 backdrop-blur md:hidden"
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
    </BottomBar>
  );
}
