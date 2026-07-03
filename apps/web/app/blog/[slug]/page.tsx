"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, PawPrint } from "lucide-react";
import { Badge, Button, Skeleton } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
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
              <Badge variant="secondary" className="mb-4">
                {isAr ? post.category.nameAr : post.category.nameEn}
              </Badge>
            )}
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {isAr ? post.titleAr : post.titleEn}
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              {post.authorName} · {fmtDate(post.publishedAt)}
            </p>

            <div className="my-10 grid aspect-[21/9] place-items-center rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10">
              <PawPrint className="size-12 text-primary/30" />
            </div>

            <div className="space-y-6 text-base leading-relaxed text-foreground/90">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            <div className="mt-14 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
              <h3 className="font-display text-lg font-semibold">
                {isAr ? "جاهز تبدأ صندوق قطك؟" : "Ready to start your cat's box?"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {isAr ? "كميات محسوبة بيطرياً، تصل كل شهر." : "Vet-calculated quantities, delivered monthly."}
              </p>
              <Link href="/#plans"><Button className="mt-4">{isAr ? "تصفّح الباقات" : "Browse plans"}</Button></Link>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
