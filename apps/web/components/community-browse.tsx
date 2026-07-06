"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, Eye, Star, Sparkles, PawPrint, Flame, Clock } from "lucide-react";
import { Badge, Skeleton, cn } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { api, type CommunityCard } from "@/lib/api";
import { localizeName } from "@/lib/translit";
import { ImgWithFallback } from "@/components/img-with-fallback";

/**
 * Community browse experience, shared by the public /community page (marketing
 * chrome) and /portal/community (inside the dashboard shell, so the dashboard
 * nav dock never disappears). The section dock is sticky + horizontally
 * scrollable so it stays visible while browsing on any screen.
 */

// Sections map to real backend sorts (no fake "likes" system).
const SECTIONS = [
  { key: "recent", icon: Clock, en: "Newest", ar: "الأحدث" },
  { key: "viewed", icon: Flame, en: "Trending", ar: "الرائج" },
  { key: "featured", icon: Star, en: "Featured", ar: "مميّزة" },
] as const;

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

export function CommunityBrowse({ compact = false }: { compact?: boolean }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const [section, setSection] = React.useState<string>("recent");
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [stage, setStage] = React.useState("");
  const [breedId, setBreedId] = React.useState("");
  const [cityId, setCityId] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const facets = useQuery({ queryKey: ["community-facets"], queryFn: () => api.communityFacets() });
  const { data, isLoading, isError } = useQuery({
    queryKey: ["community", { section, gender, stage, breedId, cityId, debounced }],
    queryFn: () =>
      api.community({
        sort: section,
        gender: gender || undefined,
        stage: stage || undefined,
        breedId: breedId || undefined,
        cityId: cityId || undefined,
        search: debounced || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const cats = data?.items ?? [];

  return (
    <div className={cn("mx-auto w-full", compact ? "max-w-5xl" : "max-w-6xl px-4")}>
      {!compact && (
        <header className="mb-6 text-center">
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="size-3.5" />
            {isAr ? "مجتمع مرقط" : "Moracat Community"}
          </Badge>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {isAr ? "قطط بهوية" : "Cats with an identity"}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            {isAr
              ? "تصفّح قطط المجتمع التي شاركها أصحابها — كل واحدة بهويتها الخاصة."
              : "Meet the community's cats, shared by their people — each with a Cat ID of their own."}
          </p>
        </header>
      )}
      {compact && (
        <h1 className="mb-3 font-display text-2xl font-bold tracking-tight">{isAr ? "المجتمع" : "Community"}</h1>
      )}

      {/* ── Section dock — sticky + horizontally scrollable, always visible ── */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-border/70 bg-background/85 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div
          role="tablist"
          aria-label={isAr ? "أقسام المجتمع" : "Community sections"}
          className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SECTIONS.map((s) => {
            const active = section === s.key;
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={active}
                onClick={() => setSection(s.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-e1"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <s.icon className={cn("size-4", active && s.key === "featured" && "fill-current")} />
                {isAr ? s.ar : s.en}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Secondary filters ────────────────────────────────────────────── */}
      <div className="mb-6 mt-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? "ابحث باسم القط…" : "Search by cat name…"}
            className="h-11 w-full rounded-full border border-border bg-card ps-10 pe-4 text-sm outline-none ring-primary/20 transition focus:ring-2"
            aria-label={isAr ? "بحث" : "Search"}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChips value={gender} onChange={setGender} options={GENDERS.map((g) => ({ key: g.key, label: isAr ? g.ar : g.en }))} />
          <FilterChips value={stage} onChange={setStage} options={STAGES.map((s) => ({ key: s.key, label: isAr ? s.ar : s.en }))} />
          {facets.data && facets.data.breeds.length > 0 && (
            <Dropdown
              value={breedId}
              onChange={setBreedId}
              placeholder={isAr ? "الفصيلة" : "Breed"}
              options={facets.data.breeds.map((b) => ({ value: b.id, label: isAr ? b.nameAr : b.nameEn }))}
            />
          )}
          {facets.data && facets.data.cities.length > 0 && (
            <Dropdown
              value={cityId}
              onChange={setCityId}
              placeholder={isAr ? "المدينة" : "City"}
              options={facets.data.cities.map((c) => ({ value: c.id, label: isAr ? c.nameAr : c.nameEn }))}
            />
          )}
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
        <EmptyLike
          icon={PawPrint}
          title={isAr ? "تعذّر تحميل المجتمع" : "Couldn't load the community"}
          body={isAr ? "حاول تحديث الصفحة." : "Please try refreshing the page."}
        />
      ) : cats.length === 0 ? (
        <EmptyLike
          icon={PawPrint}
          title={isAr ? "لا توجد قطط هنا بعد" : "No cats here yet"}
          body={
            isAr
              ? "كن أول من يشارك قطه مع المجتمع من صفحة القط."
              : "Be the first to share your cat with the community from your cat's page."
          }
        />
      ) : (
        <Grid>
          {cats.map((cat) => (
            <CommunityCatCard key={cat.slug} cat={cat} isAr={isAr} />
          ))}
        </Grid>
      )}

      {data && data.pagination.total > 0 && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {isAr ? `${data.pagination.total} قط في المجتمع` : `${data.pagination.total} cats in the community`}
        </p>
      )}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{children}</div>;
}

function CommunityCatCard({ cat, isAr }: { cat: CommunityCard; isAr: boolean }) {
  const name = localizeName(cat.name, isAr ? "ar" : "en");
  const meta = [cat.breed && (isAr ? cat.breed.nameAr : cat.breed.nameEn), cat.city && (isAr ? cat.city.nameAr : cat.city.nameEn)]
    .filter(Boolean)
    .join(isAr ? " · " : " · ");
  return (
    <Link href={`/community/${cat.slug}`} className="group">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-e1 transition-transform duration-200 group-hover:-translate-y-0.5">
        <div className="relative aspect-square overflow-hidden bg-muted">
          <ImgWithFallback
            src={cat.photoUrl}
            alt={name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            fallback={
              <span className="grid size-full place-items-center">
                <PawPrint className="size-10 text-muted-foreground/40" />
              </span>
            }
          />
          {cat.isFeatured && (
            <Badge variant="secondary" className="absolute start-2 top-2 gap-1 bg-background/85 backdrop-blur">
              <Star className="size-3 fill-accent text-accent" /> {isAr ? "مميّز" : "Featured"}
            </Badge>
          )}
        </div>
        <div className="p-3">
          <p className="truncate font-display font-semibold">{name}</p>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="truncate text-xs text-muted-foreground">{meta || (isAr ? "قط مرقط" : "A Moracat")}</p>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
              <Eye className="size-3" /> {cat.viewCount}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function FilterChips({
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
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.key ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Dropdown({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={placeholder}
      className={cn(
        "h-8 rounded-full border px-3 text-xs font-medium outline-none transition-colors",
        value ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground"
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function EmptyLike({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-border py-16 text-center">
      <Icon className="size-10 text-muted-foreground/40" />
      <p className="mt-3 font-display text-lg font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
