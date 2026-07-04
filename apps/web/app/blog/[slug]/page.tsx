"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button, Skeleton } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IlloCat, IlloFish, IlloSprig, Sticker } from "@/components/illustrations";
import { useLocale } from "@/app/providers";
import { api } from "@/lib/api";

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const { data: post, isLoading, isError } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: () => api.blogPost(slug),
    enabled: !!slug,
  });

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(isAr ? "ar-SA" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  const body = post ? (isAr ? post.bodyAr : post.bodyEn) ?? "" : "";
  const paragraphs = body.split(/\n\n+/).filter(Boolean);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <article className="container max-w-3xl py-12">
        <Link href="/blog">
          <Button variant="ghost" size="sm" className="mb-8">
            <ArrowLeft className="size-4 rtl:rotate-180" /> {isAr ? "كل المقالات" : "All articles"}
          </Button>
        </Link>

        {isError ? (
          <p className="py-16 text-center text-muted-foreground">{isAr ? "المقال غير موجود" : "Article not found"}</p>
        ) : isLoading || !post ? (
          <div className="space-y-4">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-8 h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <>
            {post.category && (
              <span className="mb-5 inline-block rounded-full bg-butter/60 px-3.5 py-1 text-xs font-semibold text-foreground/80 dark:bg-butter/25 dark:text-foreground">
                {isAr ? post.category.nameAr : post.category.nameEn}
              </span>
            )}
            <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              {isAr ? post.titleAr : post.titleEn}
            </h1>
            <p className="mt-5 text-sm text-muted-foreground">
              {post.authorName} · {fmtDate(post.publishedAt)}
            </p>

            {/* Cover — a tinted panel where the cat is the hero (R080: one scene). */}
            <div className="relative my-12 grid aspect-[21/9] place-items-center overflow-hidden rounded-[2rem] border border-border/60 bg-cream">
              <IlloCat tone="green" className="h-24 w-auto sm:h-32" />
              <Sticker rotate={14} className="end-8 top-6">
                <IlloSprig tone="leaf" className="h-12 w-auto opacity-60" />
              </Sticker>
            </div>

            <div className="mx-auto max-w-prose space-y-7 text-[17px] leading-8 text-foreground/90">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            <div className="relative mt-16 overflow-hidden rounded-[2rem] border border-border bg-butter/40 p-8 text-center shadow-e1 dark:bg-butter/15 sm:p-10">
              <IlloFish
                tone="orange"
                className="pointer-events-none absolute -bottom-2 -end-3 h-10 w-auto rotate-[-10deg] opacity-60"
              />
              <h3 className="font-display text-2xl font-semibold tracking-tight">
                {isAr ? "جاهز تبدأ صندوق قطك؟" : "Ready to start your cat's box?"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {isAr ? "كميات محسوبة بيطرياً، تصل كل شهر." : "Vet-calculated quantities, delivered monthly."}
              </p>
              <Link href="/#plans"><Button size="lg" className="mt-5">{isAr ? "تصفّح الباقات" : "Browse plans"}</Button></Link>
            </div>
          </>
        )}
      </article>

      <SiteFooter />
    </div>
  );
}
