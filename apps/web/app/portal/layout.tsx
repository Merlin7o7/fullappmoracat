"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Repeat, Cat, Package, MapPin, Settings, Users,
  LifeBuoy, Bell, LogOut, Loader2,
} from "lucide-react";
import { cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { CatProvider, useCats } from "@/lib/cat-context";
import { buildGreeting, type Gender } from "@/lib/greeting";
import { CatSwitcher } from "@/components/cat-switcher";
import { ThemeToggle, LangToggle } from "@/components/toggles";
import { Logo } from "@/components/logo";
import { IlloPaw } from "@/components/illustrations";

const NAV = [
  { href: "/portal", icon: LayoutDashboard, en: "Overview", ar: "نظرة عامة", exact: true },
  { href: "/portal/subscriptions", icon: Repeat, en: "Subscriptions", ar: "الاشتراكات" },
  { href: "/portal/cats", icon: Cat, en: "My Cats", ar: "قططي" },
  { href: "/community", icon: Users, en: "Community", ar: "المجتمع" },
  { href: "/portal/orders", icon: Package, en: "Orders", ar: "الطلبات" },
  { href: "/portal/addresses", icon: MapPin, en: "Addresses", ar: "العناوين" },
  { href: "/portal/notifications", icon: Bell, en: "Notifications", ar: "الإشعارات" },
  { href: "/portal/support", icon: LifeBuoy, en: "Support", ar: "الدعم" },
  { href: "/portal/settings", icon: Settings, en: "Settings", ar: "الإعدادات" },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();

  // Redirect unauthenticated visitors to login once hydration settles.
  React.useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    // The dashboard is gated on a verified email (OTP). Unverified → verify page.
    else if (user.emailVerified === false) router.replace("/verify-email");
  }, [ready, user, router]);

  if (!ready || !user || user.emailVerified === false) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-3">
          <IlloPaw tone="peach" className="size-8 animate-bob" />
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <CatProvider>
      <div className="flex min-h-screen">
        {/* ── The clubhouse rail — deep green, members only ── */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-primary p-4 text-primary-foreground md:flex">
          <Link href="/" aria-label="Moracat" className="mb-8 flex px-2 pt-1">
            <Logo className="h-9" priority onDark />
          </Link>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary-foreground/[0.14] text-primary-foreground"
                      : "text-primary-foreground/65 hover:bg-primary-foreground/[0.07] hover:text-primary-foreground"
                  )}
                >
                  <item.icon className="size-4" />
                  {isAr ? item.ar : item.en}
                  {active && (
                    <IlloPaw tone="orange" className="absolute end-3 size-3.5" />
                  )}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => { void logout(); router.push("/login"); }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-primary-foreground/65 transition-colors hover:bg-primary-foreground/[0.07] hover:text-primary-foreground"
          >
            <LogOut className="size-4" />
            {isAr ? "تسجيل الخروج" : "Log out"}
          </button>
        </aside>

        {/* ── Main ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
            <Link href="/" aria-label="Moracat" className="flex md:hidden">
              <Logo className="h-8" priority />
            </Link>
            <PortalGreeting isAr={isAr} gender={user.gender} firstName={user.firstName} />
            <div className="flex items-center gap-2 sm:gap-3">
              <CatSwitcher isAr={isAr} />
              <LangToggle />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 p-4 pb-28 sm:p-6 md:pb-6">{children}</main>
        </div>
      </div>

      {/* ── Mobile: thumb-zone bottom nav (R100), ≥44px targets (R092) ── */}
      <nav
        aria-label={isAr ? "التنقل" : "Navigation"}
        className="glass fixed inset-x-3 bottom-3 z-40 flex items-center justify-between gap-1 overflow-x-auto rounded-full px-2 py-1.5 md:hidden"
      >
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={isAr ? item.ar : item.en}
              aria-current={active ? "page" : undefined}
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-full transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="size-[18px]" />
            </Link>
          );
        })}
      </nav>
    </CatProvider>
  );
}

/** The warm Saudi greeting, resolved from owner gender + the primary cat (R001). */
function PortalGreeting({ isAr, gender, firstName }: { isAr: boolean; gender?: Gender; firstName?: string | null }) {
  const { primaryCat } = useCats();
  const greeting = buildGreeting({
    locale: isAr ? "ar" : "en",
    gender,
    primaryCatName: primaryCat?.name,
    firstName,
  });
  return (
    <p className="hidden min-w-0 flex-1 truncate text-sm font-medium sm:block">
      {greeting.title}
    </p>
  );
}
