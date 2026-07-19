"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Star, ArrowRight, SlidersHorizontal, Search, Sparkles } from "lucide-react";
import { Card, Badge, Skeleton, buttonVariants, cn } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { IlloCan, IlloFish, IlloMouse, IlloPaw, Sticker } from "@/components/illustrations";
import { useLocale } from "@/app/providers";
import { api, PRODUCT_TYPES, type ProductListItem } from "@/lib/api";
import { commerceEnabled } from "@/lib/features";
import { formatSAR } from "@/lib/money";

const SORTS = [
  { key: "newest", en: "Newest", ar: "الأحدث" },
  { key: "price_asc", en: "Price ↑", ar: "السعر ↑" },
  { key: "price_desc", en: "Price ↓", ar: "السعر ↓" },
  { key: "rating", en: "Top rated", ar: "الأعلى تقييماً" },
] as const;

export default function ProductsPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  // Phase 0 — the Census. Nothing is for sale, so the shop shows no price, no
  // sort-by-price, no grid, and never asks the API (which answers 403 while
  // commerce is off). One honest forthcoming page instead of a broken one
  // (R040 — never claim what the product doesn't do; R112 — no error state
  // for a deliberate decision). Flipping NEXT_PUBLIC_COMMERCE_ENABLED restores
  // every line below untouched.
  const commerce = commerceEnabled();
  const [type, setType] = React.useState("");
  const [sort, setSort] = React.useState("newest");
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", type, sort, debounced],
    queryFn: () => api.products({ type: type || undefined, sort, search: debounced || undefined }),
    enabled: commerce,
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section id="main" tabIndex={-1} className="container py-12 outline-none sm:py-16">
        {/* Editorial header — display type, one sticker accent (R080). */}
        <div className="relative mx-auto mb-10 max-w-2xl text-center">
          <Sticker rotate={12} className="-top-4 end-2 hidden sm:block">
            <IlloFish tone="orange" className="h-7 w-auto opacity-80" />
          </Sticker>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary shadow-e1">
            <IlloCan tone="pink" className="h-4 w-auto" />{" "}
            {commerce ? (isAr ? "المتجر" : "Shop") : isAr ? "قريباً" : "Coming soon"}
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            {commerce
              ? isAr ? "منتجات مختارة لقطك" : "Curated products for your cat"
              : isAr ? "نجهّز متجرنا بهدوء" : "We're preparing the shop"}
          </h1>
        </div>

        {/* ── Census mode: an honest forthcoming page, not an empty grid ────── */}
        {!commerce ? (
          <div className="mx-auto max-w-md rounded-[2rem] bg-cream/60 px-6 py-14 text-center dark:bg-cream/40">
            <IlloCan tone="green" className="mx-auto mb-5 h-14 w-auto" />
            <h2 className="font-display text-xl font-semibold tracking-tight">
              {isAr ? "لا شيء معروض للبيع بعد" : "Nothing is for sale yet"}
            </h2>
            {/* No prices, no tiers, no dates we can't keep (R006/R040). */}
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {isAr
                ? "نحن الآن في مرحلة التعداد — نتعرّف على قطط السعودية أولاً. نختار المنتجات بعناية، وحين نفتح المتجر ستكون هوية قطك جاهزة قبل الجميع."
                : "We're in the Census right now — getting to know Saudi's cats first. We're curating carefully, and when the shop opens your cat's ID will already be waiting."}
            </p>
            {/* One clear action (R005), and it's free — trust precedes the ask (R004). */}
            <Link href="/register" className={cn(buttonVariants({ variant: "brand", size: "md" }), "mt-6")}>
              <Sparkles className="size-4" />
              {isAr ? "سجّل هوية قطك مجاناً" : "Register your cat's ID — free"}
            </Link>
          </div>
        ) : (
        <>
        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {PRODUCT_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={cn(
                  // min-h-11 keeps every filter chip a ≥44px target (R092).
                  "min-h-11 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                  type === t.key
                    ? "bg-primary text-primary-foreground shadow-e1"
                    : "bg-cream/70 text-foreground/75 hover:bg-cream hover:text-foreground"
                )}
              >
                {isAr ? t.ar : t.en}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? "ابحث في المتجر…" : "Search the shop…"}
                aria-label={isAr ? "ابحث في المنتجات" : "Search products"}
                className="min-h-11 w-44 rounded-full border border-input bg-card ps-9 pe-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-52"
              />
            </div>
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label={isAr ? "ترتيب المنتجات" : "Sort products"}
              className="min-h-11 rounded-full border border-border bg-card px-3 py-1.5 text-sm"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {isAr ? s.ar : s.en}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid */}
        {isError ? (
          <EmptyState
            title={isAr ? "تعذّر تحميل المنتجات" : "We couldn't load the shop"}
            body={isAr ? "قد تكون هفوة مؤقتة — حدّث الصفحة بعد لحظات." : "This might be a hiccup on our side — refresh in a moment."}
          />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="p-3">
                <Skeleton className="mb-3 aspect-square w-full rounded-xl" />
                <Skeleton className="mb-2 h-4 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
              </Card>
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {data.items.map((p, i) => (
                <ProductCard key={p.id} product={p} isAr={isAr} index={i} />
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isAr
                ? `عرض ${data.items.length} من ${data.pagination.total} منتج`
                : `Showing ${data.items.length} of ${data.pagination.total} products`}
            </p>
          </>
        ) : (
          <EmptyState
            title={isAr ? "لا توجد منتجات" : "No products found"}
            body={isAr ? "جرّب فلتراً آخر." : "Try a different filter."}
          />
        )}
        </>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}

function ProductCard({ product, isAr, index }: { product: ProductListItem; isAr: boolean; index: number }) {
  const name = isAr ? product.nameAr : product.nameEn;
  const brand = product.brand ? (isAr ? product.brand.nameAr : product.brand.nameEn) : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.4 }}
    >
      <Card className="group flex h-full flex-col overflow-hidden p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-e2">
        <div className="relative mb-3 grid aspect-square place-items-center overflow-hidden rounded-xl bg-cream/70 dark:bg-cream">
          <ImgWithFallback
            src={product.image}
            alt={name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            fallback={
              <IlloPaw tone="butter" className="size-12 opacity-80 transition-transform duration-300 group-hover:-rotate-6" />
            }
          />
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            /* Quiet recognition, not a red shout (R085): the member price is the
               honest price — no strike-through theatre, no "Offer" urgency. */
            <Badge variant="secondary" className="absolute start-2 top-2">
              {isAr ? "سعر الأعضاء" : "Member rate"}
            </Badge>
          )}
        </div>
        {brand && <p className="text-xs text-muted-foreground">{brand}</p>}
        <h3 className="line-clamp-2 flex-1 text-sm font-medium">{name}</h3>
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="size-3.5 fill-accent text-accent" />
          {product.ratingAvg.toFixed(1)} ({product.ratingCount})
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="font-display text-lg font-bold">
            {formatSAR(product.price, isAr, { isolate: true })}
          </span>
          {/* Honest pre-commerce path (R006): the product arrives inside the
              plan — the card points at the plan, never a dead "buy". */}
          <Link
            href="/#plans"
            aria-label={isAr ? `${name} — يأتي ضمن الخطة` : `${name} — comes in the plan`}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-1.5")}
          >
            {isAr ? "يأتي ضمن الخطة" : "Comes in the plan"}
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Link>
        </div>
      </Card>
    </motion.div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md rounded-[2rem] bg-cream/60 px-6 py-16 text-center dark:bg-cream/40">
      <IlloMouse tone="sage" className="mx-auto mb-5 h-10 w-auto rtl:-scale-x-100" />
      <h3 className="font-display text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
