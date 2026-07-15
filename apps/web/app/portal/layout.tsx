"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Loader2, ShieldCheck, WifiOff } from "lucide-react";
import { cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { CatProvider, useCats } from "@/lib/cat-context";
import { useOnline } from "@/lib/offline";
import { buildGreeting, type Gender } from "@/lib/greeting";
import { CatSwitcher } from "@/components/cat-switcher";
import { ThemeToggle, LangToggle } from "@/components/toggles";
import { Logo } from "@/components/logo";
import { IlloPaw } from "@/components/illustrations";
import { NotificationsBell } from "@/app/portal/notifications/notifications-bell";
import { localizeName } from "@/lib/translit";
import { visiblePortalNav } from "./nav";
import { PortalMobileNav } from "./portal-mobile-nav";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const nav = visiblePortalNav();
  const handleLogout = React.useCallback(() => { void logout(); router.push("/login"); }, [logout, router]);

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
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-primary p-4 pt-safe text-primary-foreground md:flex">
          <Link href="/" aria-label="Moracat" className="mb-8 flex px-2 pt-1">
            <Logo className="h-9" priority onDark />
          </Link>
          <nav className="flex flex-1 flex-col gap-1">
            {nav.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary-foreground/[0.14] text-primary-foreground"
                      : "text-primary-foreground/85 hover:bg-primary-foreground/[0.07] hover:text-primary-foreground"
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
          {/* Staff-only bridge to the admin console — hidden for members (RBAC is
              enforced server-side; this is just the discoverable entry point). */}
          {user.isStaff && (
            <Link
              href="/admin"
              className="mb-1 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-accent/20"
            >
              <ShieldCheck className="size-4 text-accent" />
              {isAr ? "لوحة الإدارة" : "Admin console"}
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-primary-foreground/85 transition-colors hover:bg-primary-foreground/[0.07] hover:text-primary-foreground"
          >
            <LogOut className="size-4" />
            {isAr ? "تسجيل الخروج" : "Log out"}
          </button>
        </aside>

        {/* ── Main ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 pt-safe backdrop-blur sm:px-6">
            <Link href="/" aria-label="Moracat" className="flex md:hidden">
              <Logo className="h-8" priority />
            </Link>
            <PortalGreeting isAr={isAr} gender={user.gender} firstName={user.firstName} />
            <div className="flex items-center gap-1 sm:gap-2">
              <NotificationsBell />
              <CatSwitcher isAr={isAr} />
              <LangToggle />
              <ThemeToggle />
            </div>
          </header>
          <OfflineBanner isAr={isAr} />
          {/* pb-nav reserves room for the floating mobile nav + home indicator. */}
          <main id="main" tabIndex={-1} className="pb-nav flex-1 p-4 outline-none sm:p-6 md:pb-6">{children}</main>
        </div>
      </div>

      {/* ── Mobile: thumb-zone bottom nav (R100), ≥44px targets (R092), 320px-safe ── */}
      <PortalMobileNav items={nav} isAr={isAr} isStaff={!!user.isStaff} onLogout={handleLogout} />
    </CatProvider>
  );
}

/**
 * Offline is a *state*, not an error — so this is calm and reassuring, never
 * alarming (R007 calm over clever, R080 restraint). It confirms the cat's saved
 * ID is still in hand, which is the whole point of the offline cache (R036/R114).
 */
function OfflineBanner({ isAr }: { isAr: boolean }) {
  const online = useOnline();
  const { primaryCat } = useCats();
  if (online) return null;
  const name = primaryCat ? localizeName(primaryCat.name, isAr ? "ar" : "en") : null;
  const message = name
    ? isAr
      ? `لا يوجد اتصال — هوية ${name} المحفوظة ما زالت معك`
      : `You're offline — ${name}'s saved ID is still here`
    : isAr
      ? "لا يوجد اتصال — بياناتك المحفوظة ما زالت معك"
      : "You're offline — your saved ID is still with you";
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-border bg-muted px-4 py-2 text-center text-xs font-medium text-muted-foreground"
    >
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      {message}
    </div>
  );
}

/** The warm Saudi greeting, resolved from owner gender + the primary cat (R001).
 *  M6: the member's name is never hidden on phones — the full greeting shows on
 *  sm+, and a compact "name · cat" line takes its place on the narrowest screens. */
function PortalGreeting({ isAr, gender, firstName }: { isAr: boolean; gender?: Gender; firstName?: string | null }) {
  const { primaryCat } = useCats();
  const greeting = buildGreeting({
    locale: isAr ? "ar" : "en",
    gender,
    primaryCatName: primaryCat?.name,
    firstName,
  });

  // Compact mobile line: first name, with the primary cat as a quiet suffix.
  const name = firstName?.trim();
  const catName = primaryCat ? localizeName(primaryCat.name, isAr ? "ar" : "en") : null;
  const compact = name
    ? catName
      ? isAr ? `${name} · ${catName}` : `${name} · ${catName}`
      : name
    : greeting.title;

  return (
    <>
      <p className="min-w-0 flex-1 truncate text-sm font-medium sm:hidden">{compact}</p>
      <p className="hidden min-w-0 flex-1 truncate text-sm font-medium sm:block">{greeting.title}</p>
    </>
  );
}
