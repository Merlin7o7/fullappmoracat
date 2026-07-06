"use client";

import * as React from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Share2, Eye, MapPin, Cat as CatIcon, Cake, ArrowLeft, Check, PawPrint } from "lucide-react";
import { Badge, Button, useToast } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { CatIdCard } from "@/components/cat-id-card";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { LikeButton, useCommunityLikes } from "@/components/community-browse";
import { localizeName } from "@/lib/translit";
import type { CommunityProfile } from "@/lib/api";

const STAGE_LABEL: Record<string, [string, string]> = {
  KITTEN: ["Kitten", "هريرة"],
  ADULT: ["Adult", "بالغ"],
  SENIOR: ["Senior", "كبير"],
};

export function CommunityProfileView({ cat, slug }: { cat: CommunityProfile; slug: string }) {
  const { locale } = useLocale();
  const { toast } = useToast();
  const likes = useCommunityLikes();
  const isAr = locale === "ar";
  const name = localizeName(cat.name, isAr ? "ar" : "en");
  const [copied, setCopied] = React.useState(false);

  const shareUrl = typeof window !== "undefined" ? window.location.href : `/community/${slug}`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${name} · Moracat`, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast({ title: isAr ? "تم نسخ الرابط" : "Link copied", variant: "success" });
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* user cancelled share — no-op */
    }
  }

  const age = cat.birthDate ? computeAge(cat.birthDate, isAr) : null;
  const stage = cat.lifeStage ? (isAr ? STAGE_LABEL[cat.lifeStage]?.[1] : STAGE_LABEL[cat.lifeStage]?.[0]) : null;
  const breed = cat.breed ? (isAr ? cat.breed.nameAr : cat.breed.nameEn) : null;
  const city = cat.city ? (isAr ? cat.city.nameAr : cat.city.nameEn) : null;

  const facts = [
    breed && { icon: CatIcon, label: isAr ? "الفصيلة" : "Breed", value: breed },
    (age || stage) && { icon: Cake, label: isAr ? "العمر" : "Age", value: age ?? stage },
    city && { icon: MapPin, label: isAr ? "المدينة" : "City", value: city },
  ].filter(Boolean) as { icon: React.ElementType; label: string; value: string }[];

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-8 outline-none sm:py-12">
      <Link href="/community" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {isAr ? "المجتمع" : "Community"}
      </Link>

      {/* Cover */}
      {cat.coverUrl && (
        <div className="mb-6 aspect-[16/6] w-full overflow-hidden rounded-3xl bg-muted">
          <ImgWithFallback src={cat.coverUrl} alt="" className="size-full object-cover" fallback={<span className="block size-full" />} />
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        {/* Identity */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">{name}</h1>
            {cat.isFeatured && <Badge variant="secondary">{isAr ? "مميّز" : "Featured"}</Badge>}
          </div>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Eye className="size-3.5" /> {cat.viewCount} {isAr ? "مشاهدة" : "views"}
            {cat.ownerNickname && (
              <>
                <span className="mx-1">·</span>
                {isAr ? "برفقة " : "with "} {localizeName(cat.ownerNickname, isAr ? "ar" : "en")}
              </>
            )}
          </p>

          {cat.bio && <p className="mt-4 max-w-prose text-sm leading-relaxed text-foreground/90">{cat.bio}</p>}

          {facts.length > 0 && (
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {facts.map((f) => (
                <div key={f.label} className="rounded-xl border border-border bg-card p-3">
                  <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <f.icon className="size-3.5" /> {f.label}
                  </dt>
                  <dd className="mt-0.5 truncate font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={share}>
              {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
              {isAr ? "مشاركة" : "Share"}
            </Button>
            <LikeButton
              slug={slug}
              name={name}
              initialCount={cat.likeCount}
              likes={likes}
              isAr={isAr}
              className="border border-border px-3 hover:bg-muted"
            />
            <div className="rounded-xl bg-white p-1.5 shadow-e1 ring-hairline" title={isAr ? "امسح للزيارة" : "Scan to visit"}>
              <QRCodeSVG value={shareUrl} size={48} level="M" bgColor="#ffffff" fgColor="#0b3b30" />
            </div>
          </div>
        </div>

        {/* The Cat ID credential */}
        <div className="w-full sm:w-72">
          <CatIdCard
            catName={cat.name}
            catIdNumber={cat.catIdNumber ?? "MRC-••••-••••"}
            issuedAt={cat.issuedAt}
            photoUrl={cat.photoUrl}
            coverUrl={cat.coverUrl}
            isAr={isAr}
            membershipActive={false}
            animated
          />
        </div>
      </div>

      {/* Gallery */}
      {cat.gallery.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-lg font-semibold">{isAr ? "المعرض" : "Gallery"}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cat.gallery.map((p) => (
              <div key={p.id} className="aspect-square overflow-hidden rounded-2xl bg-muted ring-hairline">
                <ImgWithFallback
                  src={p.url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                  fallback={
                    <span className="grid size-full place-items-center">
                      <PawPrint className="size-8 text-muted-foreground/40" />
                    </span>
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function computeAge(birthDate: string, isAr: boolean): string {
  const b = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return isAr ? `${months} ${months === 1 ? "شهر" : "أشهر"}` : `${months} mo`;
  if (rem === 0) return isAr ? `${years} ${years === 1 ? "سنة" : "سنوات"}` : `${years} yr`;
  return isAr ? `${years} سنة ${rem} شهر` : `${years}y ${rem}m`;
}
