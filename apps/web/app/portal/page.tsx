"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowLeft, Siren, CalendarCheck } from "lucide-react";
import { Card, EmptyState, IdBand, Seal, Skeleton, StatusTag, cn } from "@moraqat/ui";
import { ageInMonths, formatAge } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats, type PortalCat } from "@/lib/cat-context";
import type { Gender } from "@/lib/greeting";
import { localizeName } from "@/lib/translit";
import { QueryError } from "@/components/query-error";
import { Illo3D } from "@/components/illo-3d";
import { ExploreHome } from "@/components/explore-home";
import { ReferralCard } from "@/components/referral-card";

interface Overview {
  owner: { firstName: string | null; gender: Gender; noCatYet?: boolean };
}

/**
 * «قططي» — the home is the household's cats, not an account dashboard.
 *
 * The cat in focus is the hero (P09): their photo, their name at display size,
 * their ID band, one door into their profile. Every other cat is a tile that
 * opens onto its own profile. Care across cats is one tap away in العناية.
 */
export default function MyCatsHome() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { activeCats, activeCat, primaryCat, isLoading, isError, isFetching, refetch } = useCats();

  const overview = useQuery({
    queryKey: ["overview", user?.id],
    queryFn: () => authedFetch<Overview>("/account/overview"),
    enabled: !!user,
  });

  const featured = activeCat ?? primaryCat ?? activeCats[0] ?? null;
  const others = activeCats.filter((c) => c.id !== featured?.id);

  if (isError) return <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* The header already greets; the page title is the household itself. */}
      <h1 className="sr-only">{isAr ? "قططي" : "My cats"}</h1>

      {isLoading ? (
        <div className="space-y-4" aria-busy>
          <Skeleton className="aspect-[4/3] w-full rounded-2xl md:aspect-[21/9]" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Skeleton className="aspect-square rounded-2xl" />
            <Skeleton className="aspect-square rounded-2xl" />
          </div>
        </div>
      ) : !featured ? (
        overview.data?.owner.noCatYet ? (
          // Joined on purpose without a cat (R111): a real home, the register door inside it.
          <ExploreHome isAr={isAr} firstName={overview.data.owner.firstName} />
        ) : (
          <Card>
            <EmptyState
              size="page"
              art={<Illo3D name="cat" className="size-40" px={160} />}
              title={isAr ? "هنا يعيش ملف قطك" : "This is where your cat's file lives"}
              body={
                isAr
                  ? "أضف قطك وخذ هويته في مرقط: رقم دائم، سجل صحي يمشي معه، وصفحة يلقاها من يجده لو ضاع."
                  : "Add your cat and get their Moracat ID: a permanent number, a health record that travels, and a page a finder can reach if they're ever lost."
              }
              action={
                <div className="flex flex-col items-center gap-3">
                  <Link href="/portal/cats/new" className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-6 text-base font-medium text-primary-foreground hover:bg-[hsl(var(--primary-hover))]">
                    <Plus className="size-4" aria-hidden /> {isAr ? "أضف قطك" : "Add your cat"}
                  </Link>
                  <Link href="/adopt" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
                    {isAr ? "أو شوف القطط اللي تدوّر بيتاً" : "Or meet the cats looking for a home"}
                  </Link>
                </div>
              }
            />
          </Card>
        )
      ) : (
        <>
          <FeaturedCat cat={featured} isAr={isAr} />

          <section aria-labelledby="household" className="space-y-3">
            <h2 id="household" className="font-display text-2xl">
              {others.length ? (isAr ? "قطط البيت" : "Your household") : isAr ? "بيتك" : "Your home"}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {others.map((c) => (
                <CatTile key={c.id} cat={c} isAr={isAr} />
              ))}
              <Link
                href="/portal/cats/new"
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card text-center text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
              >
                <span className="grid size-11 place-items-center rounded-full bg-muted">
                  <Plus className="size-5" aria-hidden />
                </span>
                {isAr ? "أضف قطاً" : "Add a cat"}
              </Link>
            </div>
          </section>

          <Link
            href="/portal/care"
            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/25"
          >
            <span className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
                <CalendarCheck className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-medium">{isAr ? "هذا الأسبوع مع قططك" : "This week with your cats"}</span>
                <span className="block text-sm text-muted-foreground">
                  {isAr ? "التطعيمات والمواعيد والوزن — لكل قط في مكان واحد" : "Vaccines, appointments and weight — every cat, one place"}
                </span>
              </span>
            </span>
            <ArrowLeft className="size-5 shrink-0 text-muted-foreground ltr:rotate-180" aria-hidden />
          </Link>
        </>
      )}

      <ReferralCard isAr={isAr} />
    </div>
  );
}

function FeaturedCat({ cat, isAr }: { cat: PortalCat; isAr: boolean }) {
  const loc = isAr ? "ar" : "en";
  const name = localizeName(cat.name, loc);
  const facts = [
    cat.breed ? (isAr ? cat.breed.nameAr : cat.breed.nameEn) : null,
    formatAge(ageInMonths(cat.birthDate), loc),
  ].filter(Boolean) as string[];

  return (
    <Link
      href={`/portal/cats/${cat.id}`}
      className="group grid overflow-hidden rounded-2xl border border-border bg-card shadow-e1 transition-shadow hover:shadow-e2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div className="relative aspect-[4/3] bg-[hsl(var(--cream))] md:aspect-auto md:min-h-[22rem]">
        {cat.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cat.photoUrl} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none" />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <Illo3D name="cat" className="size-44" px={176} />
          </div>
        )}
        {cat.lostModeAt && (
          <span className="absolute start-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground">
            <Siren className="size-4" aria-hidden /> {isAr ? "مفقود" : "Lost"}
          </span>
        )}
      </div>
      <div className="flex flex-col justify-end gap-4 p-6 sm:p-8">
        {cat.isPrimary && <StatusTag tone="brand" className="w-fit">{isAr ? "القط الأساسي" : "Primary cat"}</StatusTag>}
        <div>
          <p className="font-display text-5xl leading-tight sm:text-6xl">{name}</p>
          {facts.length > 0 && <p className="mt-2 text-muted-foreground">{facts.join(" · ")}</p>}
        </div>
        <div className="overflow-hidden rounded-md">
          <IdBand kind={isAr ? "هوية مرقط" : "Moracat ID"} serial={cat.catIdNumber ?? undefined} seal={<Seal label={isAr ? "صادرة من مرقط" : "Issued by Moracat"} />} />
        </div>
        <span className="inline-flex h-11 w-fit items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground">
          {isAr ? `افتح ملف ${name}` : `Open ${name}'s profile`}
          <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function CatTile({ cat, isAr }: { cat: PortalCat; isAr: boolean }) {
  const name = localizeName(cat.name, isAr ? "ar" : "en");
  return (
    <Link href={`/portal/cats/${cat.id}`} className="group block">
      <div className={cn("relative aspect-square overflow-hidden rounded-2xl bg-[hsl(var(--cream))]")}>
        {cat.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cat.photoUrl} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" />
        ) : (
          <div className="grid size-full place-items-center">
            <span className="font-display text-5xl text-muted-foreground/60">{name.slice(0, 1)}</span>
          </div>
        )}
        {cat.lostModeAt && (
          <span className="absolute start-2 top-2 rounded-full bg-destructive px-2.5 py-0.5 text-xs font-medium text-destructive-foreground">
            {isAr ? "مفقود" : "Lost"}
          </span>
        )}
      </div>
      <p className="mt-2 truncate font-medium">{name}</p>
      {cat.catIdNumber && (
        <p className="font-mono text-xs text-muted-foreground" dir="ltr">
          {cat.catIdNumber}
        </p>
      )}
    </Link>
  );
}
