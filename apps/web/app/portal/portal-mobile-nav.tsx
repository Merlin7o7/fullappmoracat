"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, LogOut, ShieldCheck } from "lucide-react";
import { Drawer, cn } from "@moraqat/ui";
import type { PortalNavItem } from "./nav";

interface PortalMobileNavProps {
  /** Already filtered for the active commerce mode. */
  items: PortalNavItem[];
  isAr: boolean;
  isStaff: boolean;
  onLogout: () => void;
}

/**
 * Thumb-zone bottom navigation (R100). Shows ≤5 primary destinations as
 * labelled tabs that fit down to 320px, with the remainder behind a "More"
 * bottom sheet. Sits above the iOS home indicator via `.bottom-safe`, and the
 * whole app reserves scroll room with `.pb-nav` on <main>.
 */
export function PortalMobileNav({ items, isAr, isStaff, onLogout }: PortalMobileNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const isActive = React.useCallback(
    (item: PortalNavItem) => (item.exact ? pathname === item.href : pathname.startsWith(item.href)),
    [pathname],
  );

  const primary = items.filter((i) => i.primary);
  const secondary = items.filter((i) => !i.primary);
  const moreActive = secondary.some(isActive);

  const tabClass = (active: boolean) =>
    cn(
      "flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1.35rem] py-1.5 text-[0.625rem] font-medium leading-none transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <>
      <nav
        aria-label={isAr ? "التنقل" : "Navigation"}
        className="glass bottom-safe ps-safe pe-safe fixed inset-x-3 z-40 grid auto-cols-fr grid-flow-col items-stretch gap-0.5 rounded-[1.75rem] p-1.5 md:hidden"
      >
        {primary.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={tabClass(active)}
            >
              <item.icon className="size-[18px] shrink-0" aria-hidden />
              <span className="max-w-full truncate">{isAr ? item.ar : item.en}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen} className={tabClass(moreActive)}>
          <MoreHorizontal className="size-[18px] shrink-0" aria-hidden />
          <span>{isAr ? "المزيد" : "More"}</span>
        </button>
      </nav>

      <Drawer open={moreOpen} onClose={() => setMoreOpen(false)} title={isAr ? "المزيد" : "More"}>
        <div className="grid grid-cols-2 gap-2">
          {secondary.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium transition-colors",
                  active ? "border-primary/30 bg-primary/10 text-foreground" : "border-border hover:bg-muted",
                )}
              >
                <item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{isAr ? item.ar : item.en}</span>
              </Link>
            );
          })}
        </div>
        {isStaff && (
          <Link
            href="/admin"
            onClick={() => setMoreOpen(false)}
            className="mt-2 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-3 py-3 text-sm font-semibold"
          >
            <ShieldCheck className="size-4 text-accent-ink" aria-hidden />
            {isAr ? "لوحة الإدارة" : "Admin console"}
          </Link>
        )}
        <button
          type="button"
          onClick={() => { setMoreOpen(false); onLogout(); }}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="size-4" aria-hidden />
          {isAr ? "تسجيل الخروج" : "Log out"}
        </button>
      </Drawer>
    </>
  );
}
