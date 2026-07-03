"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Repeat, Cat, Package, MapPin, Settings,
  LifeBuoy, Bell, LogOut, Loader2,
} from "lucide-react";
import { Button, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { ThemeToggle, LangToggle } from "@/components/toggles";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/portal", icon: LayoutDashboard, en: "Overview", ar: "نظرة عامة", exact: true },
  { href: "/portal/subscriptions", icon: Repeat, en: "Subscriptions", ar: "الاشتراكات" },
  { href: "/portal/cats", icon: Cat, en: "My Cats", ar: "قططي" },
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
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-border bg-card p-4 md:flex">
        <Link href="/" aria-label="Moracat" className="mb-8 flex px-2">
          <Logo className="h-9" priority />
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="size-4" />
                {isAr ? item.ar : item.en}
              </Link>
            );
          })}
        </nav>
        <Button variant="ghost" size="sm" className="justify-start" onClick={() => { void logout(); router.push("/login"); }}>
          <LogOut className="size-4" />
          {isAr ? "تسجيل الخروج" : "Log out"}
        </Button>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
          <MobileNav pathname={pathname} isAr={isAr} />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.firstName ? `${isAr ? "مرحباً" : "Hi"}, ${user.firstName}` : user.email}
            </span>
            <LangToggle />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

function MobileNav({ pathname, isAr }: { pathname: string; isAr: boolean }) {
  return (
    <div className="flex gap-1 overflow-x-auto md:hidden">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} aria-label={isAr ? item.ar : item.en}
            className={cn("grid size-9 place-items-center rounded-lg", active ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            <item.icon className="size-4" />
          </Link>
        );
      })}
    </div>
  );
}
