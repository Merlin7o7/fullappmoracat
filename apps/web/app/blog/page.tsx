"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, PawPrint } from "lucide-react";
import { Card, Badge, Skeleton } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/app/providers";
import { api } from "@/lib/api";

export default function BlogPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const { data, isLoading, isError } = useQuery({ queryKey: ["blog"], queryFn: () => api.blog() });

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(isAr ? "ar-SA" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="container py-12">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <Badge variant="accent" className="mb-3">
            <BookOpen className="size-3.5" /> {isAr ? "المدونة" : "Blog"}
          </Badge>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {isAr ? "مركز المعرفة" : "The Knowledge Center"}
          </h1>
          <p className="mt-3 text-muted-foreground">
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
            {data.items.map((post, i) => (
              <motion.div
                key={post.slug}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.06, 0.3), duration: 0.5 }}
              >
                <Link href={`/blog/${post.slug}`} className="block h-full">
                  <Card interactive className="flex h-full flex-col overflow-hidden p-5">
                    <div className="mb-4 grid aspect-[16/9] place-items-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10">
                      <PawPrint className="size-8 text-primary/40" />
                    </div>
                    {post.category && (
                      <Badge variant="secondary" className="mb-2 w-fit">
                        {isAr ? post.category.nameAr : post.category.nameEn}
                      </Badge>
                    )}
                    <h2 className="font-display text-lg font-semibold leading-snug">
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
            ))}
          </div>
        ) : (
          <p className="py-16 text-center text-muted-foreground">{isAr ? "لا مقالات بعد" : "No articles yet"}</p>
        )}
      </section>
    </div>
  );
}
