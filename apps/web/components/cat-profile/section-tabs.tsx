"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@moraqat/ui";
import { catPossessive } from "@moraqat/core";
import { useCats } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";

/**
 * Profile · Health & care · Life · Safety — real links, shared by the profile
 * and its sub-pages. Each tab owns its content (audit 2026-10-04): care and
 * weight live under Health & care, the album under Life, lost mode and
 * visibility under Safety; the profile tab is the card and the "Now" ledger.
 */
export function CatSectionTabs({ catId, isAr }: { catId: string; isAr: boolean }) {
  const pathname = usePathname();
  const { cats } = useCats();
  const cat = cats.find((c) => c.id === catId);
  const base = `/portal/cats/${catId}`;
  const life = isAr ? catPossessive("حياة", cat?.gender, cat ? localizeName(cat.name, "ar") : "") || "حياته" : "Life";
  const tabs = [
    { href: base, label: isAr ? "الملف" : "Profile" },
    { href: `${base}/health`, label: isAr ? "الصحة والرعاية" : "Health & care" },
    { href: `${base}/timeline`, label: life },
    { href: `${base}/privacy`, label: isAr ? "الأمان والخصوصية" : "Safety & privacy" },
  ];
  return (
    <nav aria-label={isAr ? "أقسام الملف" : "Profile sections"} className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
