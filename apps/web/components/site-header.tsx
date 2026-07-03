"use client";

import * as React from "react";
import Link from "next/link";
import { PawPrint } from "lucide-react";
import { Button } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { ThemeToggle, LangToggle } from "./toggles";

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
      {/* Announcement bar */}
      <div className="bg-primary text-primary-foreground">
        <p className="container flex h-9 items-center justify-center text-center text-xs font-medium sm:text-sm">
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
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <PawPrint className="size-5" />
            </span>
            {t.brand}
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {[
              { href: "/#how", label: t.nav.how },
              { href: "/#plans", label: t.nav.plans },
              { href: "/products", label: t.nav.products },
              { href: "/blog", label: t.brand === "مرقط" ? "المدونة" : "Blog" },
              { href: "/tools/feeding", label: t.brand === "مرقط" ? "حاسبة التغذية" : "Calculator" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <LangToggle />
            <ThemeToggle />
            <Link href="/login" className="ms-1 hidden sm:inline-flex">
              <Button variant="primary" size="sm">{t.nav.login}</Button>
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
