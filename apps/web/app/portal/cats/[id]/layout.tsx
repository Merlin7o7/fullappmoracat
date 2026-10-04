"use client";

/**
 * Everything that belongs to one cat lives under /portal/cats/[id] (UX
 * reassessment §3 — "the cat has no home" was the product's biggest problem).
 *
 *   /portal/cats/[id]           — the profile: identity, care, health, life
 *   /portal/cats/[id]/health    — the full living record
 *   /portal/cats/[id]/privacy   — lost mode, who can see the cat, who has
 *   /portal/cats/[id]/edit      — details, photos, hand-over, lifecycle
 *
 * The profile draws its own hero; the sub-pages share a compact header that
 * is the cat (P09), plus tabs that are real links (back button + deep links).
 */

import * as React from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Avatar, EmptyState, Skeleton } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { QueryError } from "@/components/query-error";
import { CatSectionTabs } from "@/components/cat-profile/section-tabs";
import { CatPhotoPlaceholder } from "@/components/cat-photo-placeholder";

export default function CatLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { cats, isLoading, isError, refetch, isFetching } = useCats();
  const cat = cats.find((c) => c.id === params.id) ?? null;
  const base = `/portal/cats/${params.id}`;
  const onProfile = pathname === base;

  if (isError) return <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />;
  if (isLoading && !cat) {
    return (
      <div className="mx-auto max-w-4xl space-y-4" aria-busy>
        <Skeleton className="aspect-[4/3] w-full rounded-2xl sm:aspect-[21/9]" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }
  if (!cat) {
    return (
      <EmptyState
        size="page"
        title={isAr ? "ما لقينا هذا القط في بيتك" : "This cat isn't in your household"}
        body={isAr ? "ربما انتقل لمالك جديد، أو أن الرابط قديم." : "They may have moved to a new owner, or the link is old."}
        action={
          <Link href="/portal" className="inline-flex h-11 items-center rounded-md border border-border bg-card px-5 text-sm font-medium hover:bg-muted">
            {isAr ? "قطط البيت" : "Your cats"}
          </Link>
        }
      />
    );
  }

  const name = localizeName(cat.name, isAr ? "ar" : "en");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {onProfile ? null : (
        <>
          <Link href={base} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {isAr ? `ملف ${name}` : `${name}'s profile`}
          </Link>
          <header className="flex items-center gap-4">
            {cat.photoUrl ? (
              <Avatar name={cat.name} src={cat.photoUrl} size="lg" className="rounded-2xl" />
            ) : (
              // One placeholder system for a photo-less cat, at every size (audit Part 05).
              <CatPhotoPlaceholder name={name} isAr={isAr} label={null} className="size-14 shrink-0 gap-0 border-solid" />
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-2xl font-semibold sm:text-3xl">{name}</p>
              {cat.catIdNumber && (
                <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                  {cat.catIdNumber}
                </p>
              )}
            </div>
          </header>
        </>
      )}

      {!onProfile && !pathname.endsWith("/edit") && <CatSectionTabs catId={params.id} isAr={isAr} />}

      {children}
    </div>
  );
}
