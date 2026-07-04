"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, Skeleton } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IlloCat, IlloMouse, IlloSprig, Sticker, type Tone } from "@/components/illustrations";
import { useLocale } from "@/app/providers";
import { api } from "@/lib/api";

/** Rotating tints + cat tones for the article cover placeholders. */
const COVERS: { tint: string; tone: Tone }[] = [
  { tint: "bg-cream", tone: "green" },
  { tint: "bg-butter/50 dark:bg-butter/15", tone: "orange" },
  { tint: "bg-blush/40 dark:bg-blush/15", tone: "green" },
  { tint: "bg-sage/15 dark:bg-sage/10", tone: "pink" },
];

export default function BlogPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const { data, isLoading, isError } = useQuery({ queryKey: ["blog"], queryFn: () => api.blog() });

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(isAr ? "ar-SA" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="container py-14 sm:py-20">
        {/* Editorial masthead — big display type, one quiet sprig (R080). */}
        <div className="relative mx-auto mb-14 max-w-2xl text-center">
          <Sticker rotate={-14} className="-top-5 start-4 hidden sm:block">
            <IlloSprig tone="leaf" className="h-10 w-auto opacity-70" />
          </Sticker>
          <p className="mb-4 inline-flex items-center rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary shadow-e1">
            {isAr ? "المدونة" : "Blog"}
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            {isAr ? "مركز المعرفة" : "The Knowledge Center"}
          </h1>
          <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
            {isAr ? "إرشادات بيطرية وعناية عملية لقطط أسعد" : "Vet-backed guidance and practical care for happier cats"}
          </p>
        </div>

        {isError ? (
          <p className="py-16 text-center text-muted-foreground">
            {isAr ? "تعذّر تحميل المقالات — تأكد أن الخادم يعمل." : "Couldn't load articles — make sure the API is running."}
          </p>
        ) : isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="mb-4 aspect-[16/9] w-full rounded-xl" />
                <Skeleton className="mb-2 h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </Card>
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((post, i) => {
              const cover = COVERS[i % COVERS.length] ?? { tint: "bg-cream", tone: "green" as Tone };
              return (
              <motion.div
                key={post.slug}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.06, 0.3), duration: 0.5 }}
              >
                <Link href={`/blog/${post.slug}`} className="block h-full">
                  <Card interactive className="group flex h-full flex-col overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-e2">
                    <div className={`mb-4 grid aspect-[16/9] place-items-center overflow-hidden rounded-xl ${cover.tint}`}>
                      <IlloCat
                        tone={cover.tone}
                        className="h-16 w-auto transition-transform duration-300 group-hover:-translate-y-0.5"
                      />
                    </div>
                    {post.category && (
                      <span className="mb-2.5 w-fit rounded-full bg-butter/60 px-3 py-1 text-xs font-semibold text-foreground/80 dark:bg-butter/25 dark:text-foreground">
                        {isAr ? post.category.nameAr : post.category.nameEn}
                      </span>
                    )}
                    <h2 className="font-display text-xl font-semibold leading-snug tracking-tight">
                      {isAr ? post.titleAr : post.titleEn}
                    </h2>
                    <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
                      {isAr ? post.excerptAr : post.excerptEn}
                    </p>
                    <p className="mt-4 text-xs text-muted-foreground">
                      {post.authorName} · {fmtDate(post.publishedAt)}
                    </p>
                  </Card>
                </Link>
              </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="mx-auto max-w-md rounded-[2rem] bg-cream/60 px-6 py-16 text-center dark:bg-cream/40">
            <IlloMouse tone="sage" className="mx-auto mb-5 h-10 w-auto rtl:-scale-x-100" />
            <p className="font-display text-xl font-semibold tracking-tight">{isAr ? "لا مقالات بعد" : "No articles yet"}</p>
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
