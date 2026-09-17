"use client";

/**
 * The cat's own pages (MRC-PROD-001 T3): one header, two tabs.
 *
 *   /portal/cats/[id]/health   — the living record
 *   /portal/cats/[id]/privacy  — who can see it, and who has
 *
 * The cat is the hero (P09): the header is the cat, not the section. Tabs are
 * real links, so the browser back button and deep links behave.
 */

import * as React from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ArrowLeft, HeartPulse, ShieldCheck } from "lucide-react";
import { Avatar, Skeleton, cn } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { QueryError } from "@/components/query-error";

export default function CatLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { cats, isLoading, isError, refetch, isFetching } = useCats();
  const cat = cats.find((c) => c.id === params.id) ?? null;

  const tabs = [
    { href: `/portal/cats/${params.id}/health`, icon: HeartPulse, ar: "السجل الصحي", en: "Health record" },
    { href: `/portal/cats/${params.id}/privacy`, icon: ShieldCheck, ar: "الخصوصية", en: "Privacy" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/portal/cats" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" /> {isAr ? "قطط البيت" : "Your household"}
      </Link>

      {isError ? (
        <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
      ) : isLoading && !cat ? (
        <div className="flex items-center gap-4"><Skeleton className="size-16 rounded-2xl" /><Skeleton className="h-8 w-40" /></div>
      ) : !cat ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {isAr ? "ما لقينا هذا القط في بيتك." : "We couldn't find this cat in your household."}
        </div>
      ) : (
        <>
          <header className="flex items-center gap-4">
            <Avatar name={cat.name} src={cat.photoUrl} size="lg" className="rounded-2xl" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">{localizeName(cat.name, isAr ? "ar" : "en")}</h1>
              {cat.catIdNumber && <p className="font-mono text-xs text-muted-foreground" dir="ltr">{cat.catIdNumber}</p>}
            </div>
          </header>

          <nav aria-label={isAr ? "أقسام القط" : "Cat sections"} className="flex gap-1 border-b border-border">
            {tabs.map((t) => {
              const active = pathname === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
                    active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <t.icon className="size-4" /> {isAr ? t.ar : t.en}
                </Link>
              );
            })}
          </nav>

          {children}
        </>
      )}
    </div>
  );
}
