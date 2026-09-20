"use client";

import * as React from "react";
import Link from "next/link";
import { useInfiniteQuery, useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, MapPin, Loader2, ShieldCheck, Syringe, Gift } from "lucide-react";
import { Badge, Button, Skeleton, cn } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { useAuth } from "@/lib/auth";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { IlloEmpty } from "@/components/illo-panel";
import { Illo3D } from "@/components/illo-3d";
import { localizeName } from "@/lib/translit";
import {
  catLifeApi,
  cityLabel,
  feeLabel,
  formatCatAge,
  adoptionStatusLabel,
  type AdoptionCard,
} from "@/lib/cat-life-api";

/**
 * Browsing cats who need a home.
 *
 * This deliberately does NOT look like a marketplace. No price-first cards, no
 * "listings", no urgency. It is the community grid's calmer sibling: the cat's
 * face, their name, their age, and where they are — because the decision being
 * made here is about a life, not a purchase (P09, R081).
 *
 * The one commercial fact on a card is the rehoming fee, and it reads "free to
 * a good home" by default, because that is what it usually is and Moracat takes
 * no part in it either way (R006).
 *
 * Shared by the public /adopt page and the portal's adoption tab so the two can
 * never drift.
 */

const GENDERS = [
  { key: "", en: "All", ar: "الكل" },
  { key: "MALE", en: "Male", ar: "ذكر" },
  { key: "FEMALE", en: "Female", ar: "أنثى" },
] as const;

const STAGES = [
  { key: "", en: "Any age", ar: "أي عمر" },
  { key: "KITTEN", en: "Kitten", ar: "هريرة" },
  { key: "ADULT", en: "Adult", ar: "بالغ" },
  { key: "SENIOR", en: "Senior", ar: "كبير" },
] as const;

export function AdoptionBrowse({ compact = false }: { compact?: boolean }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { user } = useAuth();

  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [stage, setStage] = React.useState("");
  const [cityCode, setCityCode] = React.useState("");
  const [freeOnly, setFreeOnly] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const hasFilters = Boolean(debounced || gender || stage || cityCode || freeOnly);
  const clearFilters = () => {
    setSearch("");
    setDebounced("");
    setGender("");
    setStage("");
    setCityCode("");
    setFreeOnly(false);
  };

  const facets = useQuery({ queryKey: ["adoption-facets"], queryFn: () => catLifeApi.adoptionFacets() });

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["adoption", { gender, stage, cityCode, freeOnly, debounced }],
      queryFn: ({ pageParam = 1 }) =>
        catLifeApi.adoptionListings({
          gender: gender || undefined,
          stage: stage || undefined,
          cityCode: cityCode || undefined,
          freeOnly: freeOnly || undefined,
          search: debounced || undefined,
          page: pageParam,
        }),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
      placeholderData: keepPreviousData,
    });

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  // Infinite scroll, with a real button behind it for keyboard and SR users.
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

  return (
    <div className={cn("mx-auto w-full", compact ? "max-w-5xl" : "max-w-6xl px-4")}>
      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? "ابحث باسم القط…" : "Search by name…"}
            className="h-11 w-full rounded-full border border-border bg-card ps-10 pe-4 text-sm outline-none ring-primary/20 transition focus:ring-2"
            aria-label={isAr ? "بحث" : "Search"}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chips value={gender} onChange={setGender} options={GENDERS.map((g) => ({ key: g.key, label: isAr ? g.ar : g.en }))} />
          <Chips value={stage} onChange={setStage} options={STAGES.map((s) => ({ key: s.key, label: isAr ? s.ar : s.en }))} />
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
          <button
            type="button"
            onClick={() => setFreeOnly((v) => !v)}
            aria-pressed={freeOnly}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              freeOnly ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <Gift className="size-3.5" aria-hidden />
            {isAr ? "بدون مقابل" : "Free to a good home"}
          </button>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <Grid>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </Grid>
      ) : isError ? (
        <IlloEmpty
          name="mouse"
          tone="peach"
          float={false}
          title={isAr ? "ما قدرنا نحمّل القائمة" : "We couldn't load this"}
          body={isAr ? "الخطأ من عندنا، مو منك. جرّب مرة ثانية." : "That one's on us, not you. Give it another try."}
          action={
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              {isAr ? "أعد المحاولة" : "Try again"}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        hasFilters ? (
          <IlloEmpty
            name="mouse"
            variant="green"
            tone="sage"
            title={isAr ? "ما لقينا قط يطابق بحثك" : "No cats match that"}
            body={isAr ? "جرّب مدينة ثانية، أو امسح المرشّحات وشوف الكل." : "Try another city, or clear the filters and see everyone."}
            action={
              <Button size="sm" variant="outline" onClick={clearFilters}>
                {isAr ? "امسح المرشّحات" : "Clear filters"}
              </Button>
            }
          />
        ) : (
          // Nobody waiting is GOOD news here — say so, rather than rendering
          // this as a failure (R111, R006).
          <IlloEmpty
            name="heart"
            tone="blush"
            title={isAr ? "ما في قط ينتظر بيت اليوم 🎉" : "No cat is waiting for a home today 🎉"}
            body={
              isAr
                ? "خبر طيب. لو عندك قط تدوّر له بيتاً، تقدر تعرضه هنا — وتنتقل هويته وسجله كاملاً لصاحبه الجديد."
                : "That's good news. If you're looking for a home for a cat, you can list them here — their Cat ID and record travel with them."
            }
            action={
              <Link href={user ? "/portal/adoption" : "/register"}>
                <Button size="sm">{isAr ? "اعرض قطاً للتبني" : "List a cat for adoption"}</Button>
              </Link>
            }
          />
        )
      ) : (
        <>
          <Grid>
            {items.map((item) => (
              <AdoptionCardTile key={item.id} item={item} isAr={isAr} />
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
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{children}</div>;
}

function AdoptionCardTile({ item, isAr }: { item: AdoptionCard; isAr: boolean }) {
  const name = localizeName(item.cat.name, isAr ? "ar" : "en");
  const age = formatCatAge(item.cat.ageMonths, isAr);
  const city = cityLabel(item.city, isAr);
  const meta = [age, city].filter(Boolean).join(" · ");
  const vaccinated = item.cat.vaccinationStatus === "UP_TO_DATE";

  return (
    <Link href={`/adopt/${item.id}`} className="group block">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-e1 transition-transform duration-200 group-hover:-translate-y-0.5">
        <div className="relative aspect-square overflow-hidden bg-muted">
          <ImgWithFallback
            src={item.cat.photoUrl}
            alt={name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            fallback={
              // A cat with no photo still deserves a face — the plush object
              // stands in rather than a grey silhouette (brand: 3D tier).
              <span className="grid size-full place-items-center bg-cream/60">
                <Illo3D name="cat" className="size-24" px={96} shadow={false} />
              </span>
            }
          />
          {item.status === "RESERVED" && (
            <Badge variant="secondary" className="absolute start-2 top-2 bg-background/85 backdrop-blur">
              {adoptionStatusLabel(item.status, isAr)}
            </Badge>
          )}
          {/* The identity travels — the single most important thing this page
              says that a classifieds board cannot (R040). */}
          {item.cat.catIdNumber && (
            <span className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-[10px] font-medium text-primary backdrop-blur">
              <ShieldCheck className="size-3" aria-hidden />
              {isAr ? "بهوية" : "Has a Cat ID"}
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="truncate font-display font-semibold">{name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta || (isAr ? "قط مرقط" : "A Moracat")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                item.feeSar === 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {feeLabel(item.feeSar, isAr)}
            </span>
            {vaccinated && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Syringe className="size-2.5" aria-hidden />
                {isAr ? "مطعّم" : "Vaccinated"}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function Chips({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={cn(
            "min-h-11 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.key
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Shown on the card grid when a city filter is on but empty. */
export function AdoptionCityNote({ city, isAr }: { city: string | null; isAr: boolean }) {
  if (!city) return null;
  return (
    <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
      <MapPin className="size-3.5" aria-hidden />
      {isAr ? `القطط في ${city}` : `Cats in ${city}`}
    </p>
  );
}
