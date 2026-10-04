"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowLeft, Siren } from "lucide-react";
import { Card, EmptyState, IdBand, Ledger, LedgerRow, Seal, Skeleton, StatusTag } from "@moraqat/ui";
import { ageInMonths, formatAge, formatRelative } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats, type PortalCat } from "@/lib/cat-context";
import type { Gender } from "@/lib/greeting";
import { localizeName } from "@/lib/translit";
import { keepsakeLine, keepsakeMoment } from "@/lib/keepsake";
import { hasSharedBefore } from "@/lib/track-once";
import { QueryError } from "@/components/query-error";
import { Illo3D } from "@/components/illo-3d";
import { ExploreHome } from "@/components/explore-home";
import { ReferralCard } from "@/components/referral-card";
import { CatPhotoPlaceholder } from "@/components/cat-photo-placeholder";
import { nextCareItem, type CareResponse } from "@/components/cat-profile/cat-care";

interface Overview {
  owner: { firstName: string | null; gender: Gender; noCatYet?: boolean; memberSince?: string | null };
  stats?: { unreadNotifications?: number };
}

interface NotificationRow {
  id: string;
  createdAt: string;
  readAt: string | null;
}

const DAY = 86_400_000;
const lastSeenKey = (userId: string) => `moraqat.lastSeen.${userId}`;

/**
 * «قططي» — the home is the household's cats, not an account dashboard.
 *
 * Audit 2026-10-04 (Opportunity 5, «Portal home»): visit #5 looked like
 * visit #1. Now the featured cat leads (photo, or the neutral placeholder —
 * never a toy standing in for a real cat), then «هذا الأسبوع مع {name}»: the
 * one or two things that are true about this cat right now (lost, care due,
 * unread notices, an occasion → «عام {name}»), and «منذ آخر زيارة» only when
 * something really changed since this browser last opened the home.
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

  // Referral only after first value (audit: "a referral ask on a 0-cat
  // account"): a cat with a photo on an account at least a week old, or a
  // member who has already shared something.
  const [shared, setShared] = React.useState(false);
  React.useEffect(() => setShared(hasSharedBefore()), []);
  const memberSince = overview.data?.owner.memberSince ? +new Date(overview.data.owner.memberSince) : null;
  const weekOld = memberSince != null && Date.now() - memberSince >= 7 * DAY;
  const showReferral = activeCats.length > 0 && (shared || (weekOld && activeCats.some((c) => !!c.photoUrl)));

  if (isError) return <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* The header already greets; the page title is the household itself. */}
      <h1 className="sr-only">{isAr ? "قططي" : "My cats"}</h1>

      {isLoading ? (
        <div className="space-y-4" aria-busy>
          <Skeleton className="aspect-[4/3] w-full rounded-2xl md:aspect-[21/9]" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : !featured ? (
        overview.data?.owner.noCatYet ? (
          // Joined on purpose without a cat (R111): a real home, the register door inside it.
          <ExploreHome isAr={isAr} firstName={overview.data.owner.firstName} />
        ) : (
          <Card>
            <EmptyState
              size="page"
              art={<Illo3D name="collar" className="size-32" px={128} />}
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
                  <Link href="/adopt" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
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

          <ThisWeek cat={featured} isAr={isAr} multi={activeCats.length > 1} unread={overview.data?.stats?.unreadNotifications ?? 0} />

          {others.length > 0 ? (
            <section aria-labelledby="household" className="space-y-3">
              <h2 id="household" className="font-display text-2xl">{isAr ? "قطط البيت" : "Your household"}</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {others.map((c) => (
                  <CatTile key={c.id} cat={c} isAr={isAr} />
                ))}
                <Link
                  href="/portal/cats/new"
                  className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card text-center text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
                >
                  <span className="grid size-11 place-items-center rounded-full bg-muted">
                    <Plus className="size-5" aria-hidden />
                  </span>
                  {isAr ? "أضف قطاً" : "Add a cat"}
                </Link>
              </div>
            </section>
          ) : (
            // One cat: no lonely «بيتك» heading over a single tile — a quiet door instead.
            <Link
              href="/portal/cats/new"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <Plus className="size-4" aria-hidden />
              {isAr ? "عندك قط ثاني؟ أضفه لبيتك" : "Another cat at home? Add them"}
            </Link>
          )}
        </>
      )}

      {showReferral && <ReferralCard isAr={isAr} />}
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
    <article className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-e1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative aspect-[4/3] bg-[hsl(var(--cream))] md:aspect-auto md:min-h-[20rem]">
        {cat.photoUrl ? (
          <Link href={`/portal/cats/${cat.id}`} tabIndex={-1} aria-hidden className="group absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cat.photoUrl} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none" />
          </Link>
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6">
            <CatPhotoPlaceholder name={name} isAr={isAr} href={`/portal/cats/${cat.id}/edit#photos`} className="h-full w-auto max-w-full border-none bg-transparent" />
          </div>
        )}
        {cat.lostModeAt && (
          <span className="absolute start-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground">
            <Siren className="size-4" aria-hidden /> {isAr ? "وضع البحث" : "Lost"}
          </span>
        )}
      </div>
      <div className="flex flex-col justify-end gap-4 p-6 sm:p-8">
        <div>
          <p className="font-display text-5xl leading-tight sm:text-6xl">{name}</p>
          {facts.length > 0 && <p className="mt-2 text-muted-foreground">{facts.join(" · ")}</p>}
        </div>
        <div className="overflow-hidden rounded-md">
          <IdBand kind={isAr ? "هوية مرقط" : "Moracat ID"} serial={cat.catIdNumber ?? undefined} seal={<Seal label={isAr ? "صادرة من مرقط" : "Issued by Moracat"} />} />
        </div>
        <Link
          href={`/portal/cats/${cat.id}`}
          className="inline-flex h-11 w-fit items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-[hsl(var(--primary-hover))]"
        >
          {isAr ? `افتح ملف ${name}` : `Open ${name}'s profile`}
          <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

/**
 * «هذا الأسبوع مع {name}» — only what is true right now, most urgent first,
 * plus «منذ آخر زيارة» when (and only when) something changed since this
 * browser last opened the home. Nothing is invented to fill the space.
 */
function ThisWeek({ cat, isAr, multi, unread }: { cat: PortalCat; isAr: boolean; multi: boolean; unread: number }) {
  const { authedFetch, user } = useAuth();
  const loc = isAr ? "ar" : "en";
  const name = localizeName(cat.name, loc);

  const agenda = useQuery({
    queryKey: ["care-agenda"],
    queryFn: () => authedFetch<CareResponse>("/care"),
    enabled: !!user,
  });
  const recent = useQuery({
    queryKey: ["notifications", user?.id, 1],
    queryFn: () => authedFetch<{ items: NotificationRow[] }>("/notifications?page=1"),
    enabled: !!user,
    staleTime: 60_000,
  });

  // The previous visit, read once; this visit is recorded a moment later so a
  // re-render never compares the page with itself.
  const [lastSeen, setLastSeen] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!user?.id) return;
    const key = lastSeenKey(user.id);
    try {
      const prev = Number(localStorage.getItem(key));
      if (prev > 0) setLastSeen(prev);
    } catch {
      /* storage off — the "since" line simply never shows */
    }
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(key, String(Date.now()));
      } catch {
        /* ignore */
      }
    }, 4_000);
    return () => window.clearTimeout(t);
  }, [user?.id]);

  const tasks = agenda.data?.tasks ?? [];
  const mine = tasks.filter((t) => t.catId === cat.id);
  const next = nextCareItem(mine);
  const moment = keepsakeMoment(cat);
  const base = `/portal/cats/${cat.id}`;
  const link = "inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline";

  // «منذ آخر زيارة» — meaningful only after a real gap (6h+), and only real changes.
  const now = Date.now();
  const since = lastSeen && now - lastSeen > 6 * 3_600_000 ? lastSeen : null;
  const newNotices = since ? (recent.data?.items ?? []).filter((n) => +new Date(n.createdAt) > since).length : 0;
  const becameDue = since
    ? tasks.filter((t) => (t.state === "due" || t.state === "overdue") && +new Date(t.dueAt) > since && +new Date(t.dueAt) <= now).length
    : 0;
  const sinceParts = [
    newNotices > 0 && (isAr ? (newNotices === 1 ? "إشعار جديد" : newNotices === 2 ? "إشعاران جديدان" : `${newNotices} إشعارات جديدة`) : `${newNotices} new notice${newNotices === 1 ? "" : "s"}`),
    becameDue > 0 && (isAr ? (becameDue === 1 ? "موعد رعاية صار مستحقاً" : `${becameDue} مواعيد رعاية صارت مستحقة`) : `${becameDue} care item${becameDue === 1 ? "" : "s"} now due`),
  ].filter(Boolean) as string[];

  const rows: React.ReactNode[] = [];
  if (cat.lostModeAt) {
    rows.push(
      <LedgerRow
        key="lost"
        label={isAr ? "الأمان" : "Safety"}
        value={<Link href={`${base}/privacy`} className="inline-flex min-h-11 items-center"><StatusTag tone="critical">{isAr ? "وضع البحث مفعّل" : "Lost mode on"}</StatusTag></Link>}
        hint={isAr ? "حدّث الملصق أو أوقف البحث من هنا" : "Update the poster or end the search here"}
      />
    );
  }
  if (next) {
    rows.push(
      <LedgerRow
        key="care"
        label={isAr ? "الرعاية" : "Care"}
        value={<Link href={`${base}/health#care`} className={link}>{isAr ? next.title.ar : next.title.en}</Link>}
        hint={
          next.state === "overdue"
            ? isAr ? `متأخر — كان موعده ${formatRelative(next.dueAt, loc)}` : `Overdue — it was due ${formatRelative(next.dueAt, loc)}`
            : formatRelative(next.dueAt, loc)
        }
      />
    );
  }
  if (moment) {
    rows.push(
      <LedgerRow
        key="keepsake"
        label={isAr ? "مناسبة" : "Occasion"}
        value={<Link href={`${base}/year/${moment.year}`} className={link}>{isAr ? `عام ${name} ${moment.year}` : `${name}'s ${moment.year}`}</Link>}
        hint={keepsakeLine(moment, name, isAr)}
      />
    );
  }
  if (unread > 0) {
    rows.push(
      <LedgerRow
        key="unread"
        label={isAr ? "الإشعارات" : "Notices"}
        value={
          <Link href="/portal/notifications" className={link}>
            {isAr ? (unread === 1 ? "إشعار غير مقروء" : unread === 2 ? "إشعاران غير مقروءين" : `${unread} غير مقروءة`) : `${unread} unread`}
          </Link>
        }
      />
    );
  }

  return (
    <section aria-labelledby="this-week" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 id="this-week" className="font-display text-2xl">{isAr ? `هذا الأسبوع مع ${name}` : `This week with ${name}`}</h2>
        {multi && (
          <Link href="/portal/care" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
            {isAr ? "عناية كل القطط" : "Every cat's care"}
          </Link>
        )}
      </div>
      {sinceParts.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {isAr ? "منذ آخر زيارة: " : "Since you were last here: "}
          {sinceParts.join(isAr ? "، و" : ", ")}
        </p>
      )}
      <Card className="px-5 py-1">
        {agenda.isLoading ? (
          <div className="space-y-2 py-3" aria-busy>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : agenda.isError && rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            {isAr ? "تعذّر تحميل مواعيد الرعاية. " : "Couldn't load care dates. "}
            <button type="button" onClick={() => agenda.refetch()} className={link}>
              {isAr ? "أعد المحاولة" : "Retry"}
            </button>
          </p>
        ) : rows.length ? (
          <Ledger>{rows.slice(0, 3)}</Ledger>
        ) : (
          <p className="py-4 text-sm text-muted-foreground">
            {isAr ? `لا شيء مستحق لـ${name} هذا الأسبوع. ` : `Nothing due for ${name} this week. `}
            <Link href={`${base}/health#care`} className={link}>{isAr ? "أضف موعداً" : "Add a date"}</Link>
          </p>
        )}
      </Card>
    </section>
  );
}

function CatTile({ cat, isAr }: { cat: PortalCat; isAr: boolean }) {
  const name = localizeName(cat.name, isAr ? "ar" : "en");
  return (
    <Link href={`/portal/cats/${cat.id}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-[hsl(var(--cream))]">
        {cat.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cat.photoUrl} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" />
        ) : (
          // The same placeholder as the hero, small and wordless (one system).
          <CatPhotoPlaceholder name={name} isAr={isAr} label={null} className="size-full" />
        )}
        {cat.lostModeAt && (
          <span className="absolute start-2 top-2 rounded-full bg-destructive px-2.5 py-0.5 text-xs font-medium text-destructive-foreground">
            {isAr ? "وضع البحث" : "Lost"}
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
