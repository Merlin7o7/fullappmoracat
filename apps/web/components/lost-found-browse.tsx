"use client";

import { digitsOnly } from "@moraqat/core";
import * as React from "react";
import Link from "next/link";
import { useInfiniteQuery, useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, MapPin, Loader2, ShieldCheck, Clock, Home } from "lucide-react";
import { Badge, Button, Skeleton, cn } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { useAuth } from "@/lib/auth";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { IlloEmpty } from "@/components/illo-panel";
import { Illo3D } from "@/components/illo-3d";
import { localizeName } from "@/lib/translit";
import { relativeTime } from "@/lib/datetime";
import {
  catLifeApi,
  cityLabel,
  lostFoundStatusLabel,
  type LostFoundCard,
  type LostFoundKind,
} from "@/lib/cat-life-api";

/**
 * The reunion board.
 *
 * Two collections that are genuinely different questions — "have you seen my
 * cat?" and "does anyone know this cat?" — so they get two doors rather than
 * one mixed feed with a filter. A third door shows the cats who made it home,
 * because a board that only ever shows loss is a board people stop opening,
 * and "back home" is the number this feature is actually judged by.
 *
 * Search accepts a microchip number and matches it exactly. That is the single
 * most valuable lookup here and the one an unregistered cat depends on.
 */

const CHIP_HINT_MIN = 9;

export function LostFoundBrowse({
  defaultKind = "LOST",
  compact = false,
}: {
  defaultKind?: LostFoundKind;
  compact?: boolean;
}) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { user } = useAuth();

  const [kind, setKind] = React.useState<LostFoundKind | "REUNITED">(defaultKind);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [cityCode, setCityCode] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const facets = useQuery({ queryKey: ["lf-facets"], queryFn: () => catLifeApi.lostFoundFacets() });

  const status = kind === "REUNITED" ? "REUNITED" : "ACTIVE";
  const kindParam = kind === "REUNITED" ? undefined : kind;

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["lost-found", { kind, cityCode, debounced }],
      queryFn: ({ pageParam = 1 }) =>
        catLifeApi.lostFoundPosts({
          kind: kindParam,
          status,
          cityCode: cityCode || undefined,
          search: debounced || undefined,
          page: pageParam,
        }),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
      placeholderData: keepPreviousData,
    });

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const looksLikeChip = digitsOnly(debounced).length >= CHIP_HINT_MIN;

  const sentinelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "600px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const doors = [
    { key: "LOST" as const, icon: Search, ar: "مفقودة", en: "Lost", count: facets.data?.lost },
    { key: "FOUND" as const, icon: MapPin, ar: "لقيتها", en: "Found", count: facets.data?.found },
    { key: "REUNITED" as const, icon: Home, ar: "رجعت لأهلها", en: "Back home", count: facets.data?.reunited },
  ];

  return (
    <div className={cn("mx-auto w-full", compact ? "max-w-5xl" : "max-w-6xl px-4")}>
      {/* ── The three doors ──────────────────────────────────────────────── */}
      <div
        role="group"
        aria-label={isAr ? "أقسام مفقود وموجود" : "Lost & Found sections"}
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {doors.map((d) => {
          const active = kind === d.key;
          // "Back home" only appears once at least one cat actually made it —
          // an empty celebration shelf is worse than none (R006).
          if (d.key === "REUNITED" && !d.count) return null;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={active}
              onClick={() => setKind(d.key)}
              className={cn(
                "inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-e1"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <d.icon className="size-4" aria-hidden />
              {isAr ? d.ar : d.en}
              {d.count != null && d.count > 0 && (
                <span className={cn("tabular-nums text-xs", active ? "opacity-80" : "opacity-70")}>{d.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Search + city ────────────────────────────────────────────────── */}
      <div className="mb-6 mt-4 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? "اسم، لون، حي — أو رقم الشريحة" : "Name, colour, district — or a microchip number"}
            className="h-11 w-full rounded-full border border-border bg-card ps-10 pe-4 text-sm outline-none ring-primary/20 transition focus:ring-2"
            aria-label={isAr ? "بحث" : "Search"}
          />
        </div>
        {looksLikeChip && (
          <p className="px-2 text-xs text-primary">
            {isAr ? "نبحث عن تطابق تام لرقم الشريحة." : "Searching for an exact microchip match."}
          </p>
        )}
        {(facets.data?.cities.length ?? 0) > 0 && (
          <select
            value={cityCode}
            onChange={(e) => setCityCode(e.target.value)}
            aria-label={isAr ? "المدينة" : "City"}
            className={cn(
              "h-11 rounded-full border px-3 text-xs font-medium outline-none transition-colors",
              cityCode ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground"
            )}
          >
            <option value="">{isAr ? "كل المدن" : "All cities"}</option>
            {facets.data?.cities.map((c) => (
              <option key={c.code} value={c.code}>
                {cityLabel(c, isAr)} ({c.count})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── Board ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <Grid>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </Grid>
      ) : isError ? (
        <IlloEmpty
          name="mouse"
          tone="peach"
          float={false}
          title={isAr ? "ما قدرنا نحمّل اللوحة" : "We couldn't load the board"}
          body={isAr ? "جرّب مرة ثانية — الخطأ من عندنا." : "Give it another try — that one's on us."}
          action={
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              {isAr ? "أعد المحاولة" : "Try again"}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyBoard kind={kind} isAr={isAr} hasSearch={!!debounced || !!cityCode} signedIn={!!user} />
      ) : (
        <>
          <Grid>
            {items.map((post) => (
              <LostFoundTile key={post.id} post={post} isAr={isAr} />
            ))}
          </Grid>
          {hasNextPage && (
            <div className="mt-8 flex flex-col items-center gap-3">
              <div ref={sentinelRef} aria-hidden className="h-px w-full" />
              <Button variant="outline" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                {isAr ? "عرض المزيد" : "Show more"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function EmptyBoard({
  kind,
  isAr,
  hasSearch,
  signedIn,
}: {
  kind: LostFoundKind | "REUNITED";
  isAr: boolean;
  hasSearch: boolean;
  signedIn: boolean;
}) {
  if (hasSearch) {
    return (
      <IlloEmpty
        name="mouse"
        variant="green"
        tone="sage"
        title={isAr ? "ما في نتائج مطابقة" : "Nothing matches that"}
        body={
          isAr
            ? "جرّب مدينة ثانية أو كلمة أقل. ولو القط عنده شريحة، رقمها أدق بحث."
            : "Try another city or fewer words. If the cat is chipped, the number is the most exact search there is."
        }
      />
    );
  }
  if (kind === "REUNITED") {
    return (
      <IlloEmpty
        name="heart"
        tone="blush"
        title={isAr ? "لسّا ما رجع قط لأهله من هنا" : "No cat has made it home from here yet"}
        body={isAr ? "أول واحد بيكون له مكان في هذي الصفحة." : "The first one will have a place on this page."}
      />
    );
  }
  // An empty board is the best possible news.
  return (
    <IlloEmpty
      name={kind === "LOST" ? "heart" : "paw"}
      tone={kind === "LOST" ? "blush" : "sage"}
      title={
        kind === "LOST"
          ? isAr
            ? "ما في قط مفقود اليوم 🤍"
            : "No cat is missing today 🤍"
          : isAr
            ? "ما في قط لقيناه اليوم"
            : "No found cats right now"
      }
      body={
        kind === "LOST"
          ? isAr
            ? "خبر طيب. لو ضاع قطك — لا سمح الله — تقدر تنشر هنا خلال دقيقة، ونفعّل وضع «مفقود» على هويته."
            : "That's good news. If your cat ever goes missing, you can post here in under a minute and their Cat ID switches to lost mode."
          : isAr
            ? "لو لقيت قطاً في حيّك، انشره هنا — لو عنده شريحة، نوصل لصاحبه على طول."
            : "If you find a cat in your neighbourhood, post them here — if they're chipped, we reach their owner straight away."
      }
      action={
        <Link href={signedIn ? "/portal/lost-found" : "/register"}>
          <Button size="sm">
            {kind === "LOST"
              ? isAr
                ? "بلّغ عن قط مفقود"
                : "Report a lost cat"
              : isAr
                ? "بلّغ عن قط لقيته"
                : "Report a cat you found"}
          </Button>
        </Link>
      }
    />
  );
}

function LostFoundTile({ post, isAr }: { post: LostFoundCard; isAr: boolean }) {
  const name = post.catName ? localizeName(post.catName, isAr ? "ar" : "en") : null;
  const city = cityLabel(post.city, isAr);
  const where = [city, post.district].filter(Boolean).join(" · ");
  const lost = post.kind === "LOST";
  const home = post.status === "REUNITED";

  return (
    <Link href={`/lost-found/${post.id}`} className="group block">
      <div
        className={cn(
          "flex gap-3 overflow-hidden rounded-2xl border bg-card p-3 shadow-e1 transition-transform duration-200 group-hover:-translate-y-0.5",
          home ? "border-primary/30" : lost ? "border-destructive/25" : "border-border"
        )}
      >
        <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-28">
          <ImgWithFallback
            src={post.photoUrl}
            alt={name ?? (isAr ? "قط" : "A cat")}
            loading="lazy"
            className="size-full object-cover"
            fallback={
              <span className="grid size-full place-items-center bg-cream/60">
                <Illo3D name="cat" className="size-16" px={64} shadow={false} />
              </span>
            }
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-display font-semibold">
              {name ?? (isAr ? "قط بدون اسم" : "An unnamed cat")}
            </p>
            <Badge
              variant={home ? "default" : lost ? "destructive" : "secondary"}
              className="shrink-0"
            >
              {lostFoundStatusLabel(post.kind, post.status, isAr)}
            </Badge>
          </div>
          {where && (
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {where}
            </p>
          )}
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" aria-hidden />
            {lost
              ? isAr
                ? `فُقد ${relativeTime(post.happenedAt, isAr)}`
                : `Lost ${relativeTime(post.happenedAt, isAr)}`
              : isAr
                ? `وُجد ${relativeTime(post.happenedAt, isAr)}`
                : `Found ${relativeTime(post.happenedAt, isAr)}`}
          </p>
          {post.registered && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              <ShieldCheck className="size-3" aria-hidden />
              {isAr ? "مسجّل بهوية مرقط" : "Has a Moracat Cat ID"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
