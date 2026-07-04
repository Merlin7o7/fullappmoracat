"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { ThemeToggle, LangToggle } from "./toggles";
import { Logo } from "./logo";
import { IlloPaw } from "./illustrations";

export function SiteHeader() {
  const { t } = useLocale();
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Announcement — a quiet line of good news, not a shout (R081). */}
      <div className="border-b border-border/60 bg-cream text-cream-foreground">
        <p className="container flex h-8 items-center justify-center gap-2 text-center text-xs font-medium">
          <IlloPaw tone="orange" className="size-3.5 shrink-0" />
          {t.announce}
        </p>
      </div>

      {/* Floating glass nav */}
      <header className="sticky top-3 z-50 px-3">
        <div
          className={`container flex h-16 items-center justify-between rounded-full px-4 transition-all duration-300 ${
            scrolled ? "glass shadow-soft-lg" : "bg-transparent"
          }`}
        >
          <Link href="/" aria-label="Moracat" className="flex items-center">
            <Logo className="h-9" priority />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {[
              { href: "/#how", label: t.nav.how },
              { href: "/#plans", label: t.nav.plans },
              { href: "/products", label: t.nav.products },
              { href: "/blog", label: t.nav.blog },
              { href: "/tools/feeding", label: t.nav.tools },
            ].map((item) => (
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
            <Link href="/login" className="ms-1 hidden sm:inline-flex">
              <Button variant="brand" size="sm">{t.nav.login}</Button>
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
