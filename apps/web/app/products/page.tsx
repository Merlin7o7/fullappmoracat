"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Star, PawPrint, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { Card, Badge, Button, Skeleton, cn } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/app/providers";
import { api, PRODUCT_TYPES, type ProductListItem } from "@/lib/api";

const SORTS = [
  { key: "newest", en: "Newest", ar: "الأحدث" },
  { key: "price_asc", en: "Price ↑", ar: "السعر ↑" },
  { key: "price_desc", en: "Price ↓", ar: "السعر ↓" },
  { key: "rating", en: "Top rated", ar: "الأعلى تقييماً" },
] as const;

export default function ProductsPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [type, setType] = React.useState("");
  const [sort, setSort] = React.useState("newest");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", type, sort],
    queryFn: () => api.products({ type: type || undefined, sort }),
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="container py-10">
        <div className="mb-8 text-center">
          <Badge variant="accent" className="mb-3">
            <ShoppingBag className="size-3.5" /> {isAr ? "المتجر" : "Shop"}
          </Badge>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {isAr ? "منتجات مختارة لقطك" : "Curated products for your cat"}
          </h1>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {PRODUCT_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                  type === t.key
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {isAr ? t.ar : t.en}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-sm"
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
            title={isAr ? "تعذّر تحميل المنتجات" : "Couldn't load products"}
            body={isAr ? "تأكد أن الخادم يعمل على المنفذ 4000." : "Make sure the API is running on port 4000."}
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
      </section>
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
      <Card className="group flex h-full flex-col overflow-hidden p-3">
        <div className="relative mb-3 grid aspect-square place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 to-accent/10">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt={name} className="size-full object-cover transition-transform group-hover:scale-105" />
          ) : (
            <PawPrint className="size-10 text-primary/40" />
          )}
          {product.compareAtPrice && (
            <Badge variant="destructive" className="absolute start-2 top-2">
              {isAr ? "خصم" : "Sale"}
            </Badge>
          )}
        </div>
        {brand && <p className="text-xs text-muted-foreground">{brand}</p>}
        <h3 className="line-clamp-2 flex-1 text-sm font-medium">{name}</h3>
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="size-3.5 fill-accent text-accent" />
          {product.ratingAvg.toFixed(1)} ({product.ratingCount})
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-display text-lg font-bold">
            {product.price} <span className="text-xs font-normal text-muted-foreground">SAR</span>
          </span>
          <Button size="sm" variant="primary" className="size-9 p-0" aria-label="Add to cart">
            <ShoppingBag className="size-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <span className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-muted">
        <PawPrint className="size-8 text-muted-foreground" />
      </span>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
