import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { Button } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IlloCat, IlloFish, IlloSprig, Sticker } from "@/components/illustrations";
import { formatDate } from "@/lib/datetime";
import { BRAND } from "@/lib/org";
import type { BlogPost } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";

async function fetchPost(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${BASE}/api/content/blog/${slug}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as BlogPost;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await fetchPost(params.slug);
  if (!post) return { title: "Article not found" };
  const isAr = cookies().get("locale")?.value !== "en";
  const title = isAr ? post.titleAr : post.titleEn;
  const description = (isAr ? post.excerptAr : post.excerptEn) ?? `${title} — ${BRAND.en}`;
  const url = `${SITE}/blog/${params.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      images: post.coverUrl ? [{ url: post.coverUrl }] : undefined,
      publishedTime: post.publishedAt ?? undefined,
      authors: post.authorName ? [post.authorName] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: post.coverUrl ? [post.coverUrl] : undefined },
  };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug);
  if (!post) notFound();

  const isAr = cookies().get("locale")?.value !== "en";
  const title = isAr ? post.titleAr : post.titleEn;
  const body = (isAr ? post.bodyAr : post.bodyEn) ?? "";
  const paragraphs = body.split(/\n\n+/).filter(Boolean);
  const dateLabel = post.publishedAt ? formatDate(post.publishedAt, isAr ? "ar" : "en", { day: "numeric", month: "long", year: "numeric" }) : "";

  // BlogPosting structured data — rich results + correct attribution.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description: (isAr ? post.excerptAr : post.excerptEn) ?? undefined,
    image: post.coverUrl ?? undefined,
    datePublished: post.publishedAt ?? undefined,
    author: post.authorName ? { "@type": "Person", name: post.authorName } : { "@type": "Organization", name: BRAND.en },
    publisher: { "@type": "Organization", name: BRAND.en, logo: { "@type": "ImageObject", url: `${SITE}/opengraph-image` } },
    mainEntityOfPage: `${SITE}/blog/${params.slug}`,
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="container max-w-3xl py-12">
        <Link href="/blog">
          <Button variant="ghost" size="sm" className="mb-8">
            <ArrowLeft className="size-4 rtl:rotate-180" /> {isAr ? "كل المقالات" : "All articles"}
          </Button>
        </Link>

        {post.category && (
          <span className="mb-5 inline-block rounded-full bg-butter/60 px-3.5 py-1 text-xs font-semibold text-foreground/80 dark:bg-butter/25 dark:text-foreground">
            {isAr ? post.category.nameAr : post.category.nameEn}
          </span>
        )}
        <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 text-sm text-muted-foreground">
          {post.authorName ? `${post.authorName} · ` : ""}{dateLabel}
        </p>

        {/* Cover — the real image when present, else a tinted brand panel. */}
        {post.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverUrl} alt={title} className="my-12 aspect-[21/9] w-full rounded-[2rem] border border-border/60 object-cover" />
        ) : (
          <div className="relative my-12 grid aspect-[21/9] place-items-center overflow-hidden rounded-[2rem] border border-border/60 bg-cream">
            <IlloCat tone="green" className="h-24 w-auto sm:h-32" />
            <Sticker rotate={14} className="end-8 top-6">
              <IlloSprig tone="leaf" className="h-12 w-auto opacity-60" />
            </Sticker>
          </div>
        )}

        <div className="mx-auto max-w-prose space-y-7 text-[17px] leading-8 text-foreground/90">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div className="relative mt-16 overflow-hidden rounded-[2rem] border border-border bg-butter/40 p-8 text-center shadow-e1 dark:bg-butter/15 sm:p-10">
          <IlloFish tone="orange" className="pointer-events-none absolute -bottom-2 -end-3 h-10 w-auto rotate-[-10deg] opacity-60" />
          <h3 className="font-display text-2xl font-semibold tracking-tight">
            {isAr ? "قطك يستاهل هوية خاصة فيه" : "Your cat deserves an identity of their own"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAr ? "هوية رسمية وملف صحي ومجتمع — ابدأ مجاناً." : "An official Cat ID, a health record and a community — start free."}
          </p>
          <Link href="/register"><Button size="lg" className="mt-5">{isAr ? "سوِّ هوية قطك" : "Create your cat's ID"}</Button></Link>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
