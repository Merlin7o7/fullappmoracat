"use client";

import * as React from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Share2, MapPin, Cat as CatIcon, Cake, ArrowLeft, Check, PawPrint, ArrowRight } from "lucide-react";
import { Button, cn, useToast } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { CatIdCard } from "@/components/cat-id-card";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { LikeButton, useCommunityLikes } from "@/components/community-browse";
import { ReportCatButton } from "@/components/community-report";
import { Illo3D } from "@/components/illo-3d";
import { IlloHeart, IlloPaw, IlloSprig, Sticker } from "@/components/illustrations";
import { Sparkles } from "@/components/home/sparkles";
import { localizeName } from "@/lib/translit";
import type { CommunityProfile } from "@/lib/api";
import {
  ABOUT_Q, FAVORITES_Q, FUN_Q, PERSONALITY_Q, earnedBadges, resolvePersonalization,
  type AnswerMap, type BadgeDef, type Question,
} from "@/lib/cat-profile";
import { formatAge as coreFormatAge, formatDate as coreFormatDate } from "@moraqat/core";

const STAGE_LABEL: Record<string, [string, string]> = {
  KITTEN: ["Kitten", "هريرة"],
  ADULT: ["Adult", "بالغ"],
  SENIOR: ["Senior", "كبير"],
};

/** Badges a visitor may see: character + age only — never health (vaccines, chip). */
const PUBLIC_BADGES = new Set(["founding-member", "kitten", "senior", "foodie", "adventurer", "cuddler", "hunter", "sleep-champ", "storyteller", "stylist"]);

/**
 * A cat's public page in the community — the card exactly as the owner
 * decorated it, and the cat's character (personality, favourites, fun facts)
 * told warmly, in the homepage's glittery, rounded language. Everything shown
 * comes from the API's allow-list and the owner's per-field switches.
 */
export function CommunityProfileView({ cat, slug }: { cat: CommunityProfile; slug: string }) {
  const { locale } = useLocale();
  const { toast } = useToast();
  const likes = useCommunityLikes();
  const isAr = locale === "ar";
  const loc = isAr ? "ar" : "en";
  const name = localizeName(cat.name, loc);
  const [copied, setCopied] = React.useState(false);

  const shareUrl = typeof window !== "undefined" ? window.location.href : `/community/${slug}`;

  // Count the visit truthfully: one beacon on mount, deduped server-side.
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

  const ch = cat.character ?? null;
  const rp = resolvePersonalization(cat.personalization);
  const age = cat.ageMonths != null ? coreFormatAge(cat.ageMonths, loc) : null;
  const memberSince = cat.issuedAt ? coreFormatDate(cat.issuedAt, loc, "monthYear") : null;
  const stage = cat.lifeStage ? (isAr ? STAGE_LABEL[cat.lifeStage]?.[1] : STAGE_LABEL[cat.lifeStage]?.[0]) : null;
  const breed = cat.breed ? (isAr ? cat.breed.nameAr : cat.breed.nameEn) : null;
  const city = cat.city ? (isAr ? cat.city.nameAr : cat.city.nameEn) : null;
  const nickname = typeof ch?.about?.nickname === "string" ? ch.about.nickname : null;
  const moodEmoji = typeof ch?.fun?.emoji === "string" ? ch.fun.emoji : null;

  // Recognition from what's public only (age as months → an approximate birth date).
  const badges: BadgeDef[] = earnedBadges({
    name: cat.name,
    birthDate: cat.ageMonths != null ? new Date(Date.now() - cat.ageMonths * 30.44 * 86_400_000).toISOString() : null,
    profile: { ...(ch ?? {}), personalization: cat.personalization ?? undefined },
  }).filter((b) => PUBLIC_BADGES.has(b.id));

  const facts = [
    breed && { icon: CatIcon, label: isAr ? "الفصيلة" : "Breed", value: breed, tint: "bg-butter/60" },
    (age || stage) && { icon: Cake, label: isAr ? "العمر" : "Age", value: (age ?? stage)!, tint: "bg-blush/50" },
    city && { icon: MapPin, label: isAr ? "المدينة" : "City", value: city, tint: "bg-sage/25" },
    cat.gender === "FEMALE" && { emoji: "♀️", label: isAr ? "الجنس" : "Sex", value: isAr ? "أنثى" : "Female", tint: "bg-peach/60" },
    cat.gender === "MALE" && { emoji: "♂️", label: isAr ? "الجنس" : "Sex", value: isAr ? "ذكر" : "Male", tint: "bg-peach/60" },
    ...answerFacts(ABOUT_Q.filter((q) => q.id !== "nickname"), ch?.about, isAr).map((f) => ({ ...f, tint: "bg-cream" })),
  ].filter(Boolean) as { icon?: React.ElementType; emoji?: string; label: string; value: string; tint: string }[];

  const personality = answerFacts(PERSONALITY_Q, ch?.personality, isAr);
  const favorites = answerFacts(FAVORITES_Q, ch?.favorites, isAr);
  const fun = answerFacts(FUN_Q.filter((q) => q.id !== "emoji"), ch?.fun, isAr);

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-6 outline-none sm:py-10">
      <Link href="/community" className="mb-5 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {isAr ? "المجتمع" : "Community"}
      </Link>

      {/* ── Hero: the cat, their decorated card, and the love ─────────────── */}
      <section className="mesh-bg-rich relative overflow-hidden rounded-[2.5rem] border border-border bg-card shadow-e2">
        {cat.coverUrl && (
          <div className="absolute inset-x-0 top-0 h-40 overflow-hidden sm:h-52">
            <ImgWithFallback src={cat.coverUrl} alt="" className="size-full object-cover opacity-90" fallback={<span className="block size-full" />} />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card" />
          </div>
        )}
        <Sparkles preset="hero" />
        <div className="relative grid gap-10 p-6 pt-8 sm:p-10 lg:grid-cols-[1fr_minmax(0,22rem)] lg:items-center">
          <div className="text-center lg:text-start">
            {/* The photo, round, with their mood emoji pinned to it */}
            <div className="relative mx-auto mb-5 w-fit lg:mx-0">
              <div className="size-32 overflow-hidden rounded-full border-4 border-card bg-muted shadow-e2 ring-4 ring-primary/15 sm:size-36">
                <ImgWithFallback
                  src={cat.photoUrl}
                  alt={name}
                  className="size-full object-cover"
                  fallback={<span className="grid size-full place-items-center"><PawPrint className="size-10 text-muted-foreground/40" /></span>}
                />
              </div>
              {moodEmoji && (
                <span aria-hidden className="absolute -bottom-1 -end-2 grid size-12 place-items-center rounded-full border-4 border-card bg-butter text-2xl shadow-e1">
                  {moodEmoji}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              {cat.isFeatured && <Chip className="bg-accent/15 text-accent-ink">✨ {isAr ? "مميّز" : "Featured"}</Chip>}
              {cat.isFounding && <Chip className="bg-primary/10 text-primary">🪪 {isAr ? "عضو مؤسس" : "Founding member"}</Chip>}
            </div>
            <h1 className="mt-3 font-display text-5xl leading-tight sm:text-6xl">
              <span className="underline-marker">{name}</span>
            </h1>
            {nickname && (
              <p className="mt-2 text-lg text-muted-foreground">
                {isAr ? "يدلّعونه: " : "Also known as "}
                <span className="font-medium text-foreground">{nickname}</span>
              </p>
            )}
            {(memberSince || cat.catIdNumber) && (
              <p className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-muted-foreground lg:justify-start">
                {memberSince && <span>{isAr ? `عضو منذ ${memberSince}` : `Member since ${memberSince}`}</span>}
                {memberSince && cat.catIdNumber && <span aria-hidden>·</span>}
                {cat.catIdNumber && <span dir="ltr" className="font-mono text-xs">{cat.catIdNumber}</span>}
              </p>
            )}
            {cat.ownerNickname && (
              <p className="mt-1 text-sm text-muted-foreground">
                {isAr ? "برفقة " : "with "}
                {localizeName(cat.ownerNickname, loc)}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <LikeButton
                slug={slug}
                name={name}
                initialCount={cat.likeCount}
                likes={likes}
                isAr={isAr}
                className="rounded-full border border-border bg-card px-4 hover:bg-muted"
              />
              <Button size="sm" className="btn-shine rounded-full px-5" onClick={share}>
                {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
                {isAr ? `شارك ${name}` : `Share ${name}`}
              </Button>
            </div>

            {cat.bio && (
              <div className="relative mt-6 rounded-[1.75rem] border border-border bg-card/90 p-5 text-start shadow-e1 backdrop-blur">
                <span aria-hidden className="absolute -top-3 start-6 rounded-full bg-blush px-3 py-0.5 text-xs font-medium">💬 {isAr ? "عنه" : "About"}</span>
                <p className="text-base leading-relaxed text-foreground/90">{cat.bio}</p>
              </div>
            )}
          </div>

          {/* The Cat ID — exactly as its owner decorated it */}
          <div className="relative mx-auto w-full max-w-sm pt-14">
            <Illo3D name="cat" px={128} className="absolute end-4 top-0 z-0 size-28 motion-safe:animate-float" />
            <Sticker rotate={-14} className="-start-4 top-16 z-20 hidden sm:block"><IlloHeart tone="pink" className="size-9" /></Sticker>
            <Sticker rotate={16} className="-bottom-6 -end-4 z-20 hidden sm:block"><IlloPaw tone="butter" className="size-11" /></Sticker>
            <div className="relative z-10 rotate-[-2deg] transition-transform duration-500 hover:rotate-0 motion-reduce:transition-none">
              <CatIdCard
                catName={cat.name}
                catIdNumber={cat.catIdNumber ?? "MRC-••••-••••"}
                issuedAt={cat.issuedAt}
                photoUrl={cat.photoUrl}
                coverUrl={cat.coverUrl}
                isAr={isAr}
                // A public profile is about identity, never billing (fire #8).
                hideStatus
                animated
                themeField={rp.themeField}
                accentHsl={rp.accentHsl}
                frame={rp.frame}
                stickers={rp.stickers}
                className="shadow-glow"
              />
            </div>
            {rp.isCustomised && (
              <p className="mt-4 text-center text-xs text-muted-foreground">🎨 {isAr ? `صمّم أهله بطاقته بأنفسهم` : `Card styled by ${name}'s family`}</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Badges ─────────────────────────────────────────────────────────── */}
      {badges.length > 0 && (
        <section aria-labelledby="badges-h" className="mt-8">
          <h2 id="badges-h" className="sr-only">{isAr ? "الأوسمة" : "Badges"}</h2>
          <ul className="flex flex-wrap justify-center gap-2 lg:justify-start">
            {badges.map((b, i) => (
              <li
                key={b.id}
                title={isAr ? b.whyAr : b.whyEn}
                className={cn("inline-flex items-center gap-2 rounded-full border border-foreground/10 px-4 py-2 text-sm font-medium shadow-e1", BADGE_TINTS[i % BADGE_TINTS.length])}
              >
                <span aria-hidden className="text-base">{b.emoji}</span> {isAr ? b.ar : b.en}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Quick facts ────────────────────────────────────────────────────── */}
      {facts.length > 0 && (
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className={cn("rounded-[1.5rem] border border-border/60 p-4", f.tint)}>
              <dt className="flex items-center gap-1.5 text-xs text-foreground/70">
                {f.icon ? <f.icon className="size-3.5" aria-hidden /> : <span aria-hidden>{f.emoji}</span>} {f.label}
              </dt>
              <dd className="mt-1 truncate text-base font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* ── Character ──────────────────────────────────────────────────────── */}
      {personality.length > 0 && (
        <CharacterPanel
          title={isAr ? `شخصية ${name}` : `${name}'s personality`}
          illo="heart"
          tint="bg-blush/30 dark:bg-blush/10"
          items={personality}
        />
      )}
      {favorites.length > 0 && (
        <CharacterPanel
          title={isAr ? "أشياء يحبها" : "Favourite things"}
          illo="fish"
          tint="bg-butter/40 dark:bg-butter/10"
          items={favorites}
        />
      )}
      {fun.length > 0 && (
        <CharacterPanel
          title={isAr ? "أسرار وطرائف" : "Fun facts"}
          illo="mouse"
          tint="bg-sage/20 dark:bg-sage/10"
          items={fun}
        />
      )}

      {/* ── Gallery ────────────────────────────────────────────────────────── */}
      {cat.gallery.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-3xl">{isAr ? "ألبوم الصور" : "Photo album"}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cat.gallery.map((p, i) => (
              <div
                key={p.id}
                className={cn(
                  "aspect-square overflow-hidden rounded-[1.75rem] bg-muted shadow-e1 transition-transform duration-300 hover:rotate-0 motion-reduce:transition-none",
                  i % 3 === 0 ? "-rotate-1" : i % 3 === 1 ? "rotate-1" : "rotate-0"
                )}
              >
                <ImgWithFallback
                  src={p.url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                  fallback={<span className="grid size-full place-items-center"><PawPrint className="size-8 text-muted-foreground/40" /></span>}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── The invitation: every visitor is one cat away from their own ID ── */}
      <section className="mesh-bg-rich relative mt-12 overflow-hidden rounded-[2.5rem] border border-border bg-card px-6 py-12 text-center shadow-e2">
        <Sparkles preset="panel" />
        <Sticker rotate={-12} className="start-8 top-8 hidden md:block"><IlloSprig tone="leaf" className="h-14 w-auto opacity-70" /></Sticker>
        <p className="relative font-display text-4xl">{isAr ? "قطك يستاهل هوية مثل هذي" : "Your cat deserves one too"}</p>
        <p className="relative mx-auto mt-3 max-w-md text-muted-foreground">
          {isAr ? "هوية باسمه ورقمه، ومكان يحكي شخصيته — مجاناً، في أقل من دقيقتين." : "An ID with their name and number, and a page for their personality — free, in under two minutes."}
        </p>
        <Link href="/register" className="relative mt-6 inline-block">
          <Button size="lg" className="btn-shine rounded-full px-8">
            {isAr ? "سوّ هوية قطك" : "Create your cat's ID"} <ArrowRight className="size-4 rtl:rotate-180" />
          </Button>
        </Link>
      </section>

      {/* Quiet trust affordances — reporting is always within reach, never loud. */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <ReportCatButton slug={slug} name={name} isAr={isAr} className="rounded-full border border-border hover:bg-muted" />
        <div className="rounded-xl bg-white p-1.5 shadow-e1" title={isAr ? "امسح للزيارة" : "Scan to visit"}>
          <QRCodeSVG value={shareUrl} size={48} level="M" bgColor="#ffffff" fgColor="#0b3b30" title={isAr ? `رمز صفحة ${name}` : `QR code for ${name}’s page`} />
        </div>
      </div>
    </main>
  );
}

const BADGE_TINTS = ["bg-butter/70", "bg-blush/60", "bg-sage/30", "bg-peach/70", "bg-cream"];

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium", className)}>{children}</span>;
}

type Fact = { emoji: string; label: string; value: string };

/** Turn stored answers into human labels, in question order (choices → their label + emoji). */
function answerFacts(questions: Question[], answers: AnswerMap | undefined, isAr: boolean): Fact[] {
  if (!answers) return [];
  const out: Fact[] = [];
  for (const q of questions) {
    const raw = answers[q.id];
    if (raw == null || (Array.isArray(raw) && !raw.length) || raw === "") continue;
    const label = isAr ? q.ar : q.en;
    const opt = (v: string) => q.options?.find((o) => o.value === v);
    if (Array.isArray(raw)) {
      const vals = raw.map((v) => { const o = opt(v); return o ? `${o.emoji ? `${o.emoji} ` : ""}${isAr ? o.ar : o.en}` : v; });
      out.push({ emoji: q.emoji, label, value: vals.join(isAr ? "، " : ", ") });
    } else {
      const o = opt(raw);
      out.push({ emoji: o?.emoji ?? q.emoji, label, value: o ? (isAr ? o.ar : o.en) : raw });
    }
  }
  return out;
}

function CharacterPanel({ title, illo, tint, items }: { title: string; illo: "heart" | "fish" | "mouse"; tint: string; items: Fact[] }) {
  return (
    <section className={cn("relative mt-8 overflow-hidden rounded-[2rem] border border-border/60 p-6 sm:p-8", tint)}>
      <Sparkles preset="panel" />
      <div className="relative mb-5 flex items-center gap-3">
        <Illo3D name={illo} px={72} className="relative size-16 shrink-0 motion-safe:animate-float" />
        <h2 className="font-display text-3xl">{title}</h2>
      </div>
      <dl className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f) => (
          <div key={f.label} className="rounded-[1.5rem] bg-card/90 p-4 shadow-e1 backdrop-blur">
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd className="mt-1 flex items-start gap-2 text-base font-medium">
              <span aria-hidden className="text-lg leading-6">{f.emoji}</span>
              <span className="min-w-0 break-words">{f.value}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
