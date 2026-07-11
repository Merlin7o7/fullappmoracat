"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button, cn } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { ThemeToggle, LangToggle } from "./toggles";
import { Logo } from "./logo";
import { IlloPaw } from "./illustrations";

export function SiteHeader() {
  const { t, locale } = useLocale();
  const isAr = locale === "ar";
  const [scrolled, setScrolled] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pathname = usePathname();
  const toggleRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on route change.
  React.useEffect(() => setMenuOpen(false), [pathname]);

  // Escape closes the menu and returns focus to the toggle; lock body scroll.
  React.useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !toggleRef.current?.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    // Move focus into the panel for keyboard users.
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menuOpen]);

  const navItems = [
    { href: "/#how", label: t.nav.how },
    { href: "/community", label: t.nav.community },
    { href: "/products", label: t.nav.products },
    { href: "/blog", label: t.nav.blog },
    { href: "/tools/feeding", label: t.nav.tools },
  ];

  return (
    <>
      {/* Announcement — a quiet line of good news, not a shout (R081). */}
      <div className="border-b border-border/60 bg-cream text-cream-foreground">
        <p className="container flex min-h-8 items-center justify-center gap-2 py-1 text-center text-xs font-medium">
          <IlloPaw tone="orange" className="size-3.5 shrink-0" />
          {t.announce}
        </p>
      </div>

      {/* Floating glass nav */}
      <header className="sticky top-3 z-50 px-3">
        <div
          className={cn(
            "container flex h-16 items-center justify-between rounded-full px-4 transition-all duration-300",
            scrolled || menuOpen ? "glass shadow-soft-lg" : "bg-transparent"
          )}
        >
          <Link href="/" aria-label="Moracat" className="flex items-center">
            <Logo className="h-9" priority />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <LangToggle />
            <ThemeToggle />
            {/* Login is reachable at EVERY width (returning members on phones). */}
            <Link href="/login" className="ms-1 inline-flex">
              <Button variant="brand" size="sm">{t.nav.login}</Button>
            </Link>
            {/* Mobile nav disclosure — the links that md:flex hides. */}
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? (isAr ? "إغلاق القائمة" : "Close menu") : (isAr ? "فتح القائمة" : "Open menu")}
              className="ms-1 grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav panel */}
        {menuOpen && (
          <div
            id="mobile-nav"
            ref={panelRef}
            className="glass container mt-2 rounded-3xl p-2 shadow-soft-lg md:hidden"
          >
            <nav className="flex flex-col">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
