"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@moraqat/ui";

/** Profile · Health record · Safety & privacy — real links, shared by the profile and its sub-pages. */
export function CatSectionTabs({ catId, isAr }: { catId: string; isAr: boolean }) {
  const pathname = usePathname();
  const base = `/portal/cats/${catId}`;
  const tabs = [
    { href: base, ar: "الملف", en: "Profile" },
    { href: `${base}/health`, ar: "السجل الصحي", en: "Health record" },
    { href: `${base}/timeline`, ar: "حياته", en: "Life" },
    { href: `${base}/privacy`, ar: "الأمان والخصوصية", en: "Safety & privacy" },
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
            {isAr ? t.ar : t.en}
          </Link>
        );
      })}
    </nav>
  );
}
