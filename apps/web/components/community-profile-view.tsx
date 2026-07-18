"use client";

import * as React from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Share2, MapPin, Cat as CatIcon, Cake, ArrowLeft, Check, PawPrint } from "lucide-react";
import { Badge, Button, useToast } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { CatIdCard } from "@/components/cat-id-card";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { LikeButton, useCommunityLikes } from "@/components/community-browse";
import { ReportCatButton } from "@/components/community-report";
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

  // Count the visit truthfully: one beacon on mount, deduped server-side.
  // Fire-and-forget — a lost beacon must never affect the visitor.
  React.useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
    const url = `${base}/api/community/cats/${slug}/view`;
    try {
      const sent = typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url);
      if (!sent) void fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
    } catch {
      /* never surface — the view tally is best-effort by design */
    }
  }, [slug]);

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

  const age = cat.ageMonths != null ? formatAge(cat.ageMonths, isAr) : null;
  // "Member since {month year}" — the credential line (tenure, not points).
  const memberSince = cat.issuedAt
    ? new Intl.DateTimeFormat(isAr ? "ar" : "en", { month: "long", year: "numeric" }).format(new Date(cat.issuedAt))
    : null;
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
        {/* Identity — the profile reads as a membership credential: name, then
            tenure + ID number, then love. Never raw view counts in public. */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">{name}</h1>
            {cat.isFeatured && <Badge variant="secondary">{isAr ? "مميّز" : "Featured"}</Badge>}
            {cat.isFounding && (
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {isAr ? "عضو مؤسس" : "Founding member"}
              </Badge>
            )}
          </div>

          {/* The credential line (R032: the human-readable number is worn with pride). */}
          {(memberSince || cat.catIdNumber) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              {memberSince && <span>{isAr ? `عضو منذ ${memberSince}` : `Member since ${memberSince}`}</span>}
              {memberSince && cat.catIdNumber && <span aria-hidden>·</span>}
              {cat.catIdNumber && (
                <span dir="ltr" className="font-mono text-xs tracking-wide">
                  {cat.catIdNumber}
                </span>
              )}
            </p>
          )}

          {cat.ownerNickname && (
            <p className="mt-1 text-sm text-muted-foreground">
              {isAr ? "برفقة " : "with "}
              {localizeName(cat.ownerNickname, isAr ? "ar" : "en")}
            </p>
          )}

          {/* Love + share sit right under the credential — pride, gently shareable. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <LikeButton
              slug={slug}
              name={name}
              initialCount={cat.likeCount}
              likes={likes}
              isAr={isAr}
              className="border border-border px-3 hover:bg-muted"
            />
            <Button size="sm" onClick={share}>
              {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
              {isAr ? `شارك بطاقة ${name}` : `Share ${name}'s card`}
            </Button>
          </div>

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
            {/* Quiet trust affordance — reporting is always within reach, never loud. */}
            <ReportCatButton slug={slug} name={name} isAr={isAr} className="border border-border hover:bg-muted" />
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
            // A public profile is about identity, never billing. Never disclose
            // or misstate a member's standing to visitors — hide the status pill
            // entirely so a shared card reads as pride, not "Inactive" (fire #8).
            hideStatus
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

/** Render the server-computed month tally (the raw birth date never reaches the client). */
function formatAge(months: number, isAr: boolean): string {
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return isAr ? `${months} ${months === 1 ? "شهر" : "أشهر"}` : `${months} mo`;
  if (rem === 0) return isAr ? `${years} ${years === 1 ? "سنة" : "سنوات"}` : `${years} yr`;
  return isAr ? `${years} سنة ${rem} شهر` : `${years}y ${rem}m`;
}
