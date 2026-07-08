"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Share2, ArrowRight, Sparkles, IdCard, Clock } from "lucide-react";
import { Button, Badge, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { CatIdCard } from "@/components/cat-id-card";
import { CatIdStory } from "@/components/cat-id-story";
import { MoracatStory } from "@/components/moracat-story";
import { shareStoryPng, exportSafeSrc } from "@/lib/card-export";
import { IlloPaw, IlloHeart, Sticker } from "@/components/illustrations";

interface WelcomeCat {
  id: string;
  name: string;
  catIdNumber: string | null;
  idIssuedAt: string | null;
  photoUrl: string | null;
  qrToken: string | null;
}

/**
 * Stage 4 — Welcome & First Value. The one-time celebration shown the FIRST time
 * a member issues a Cat ID (routed here from the ceremony on `firstCatIdIssued`;
 * never auto-shown again — see cats.service `onboardedAt`). It congratulates,
 * frames the ID as *Inactive until membership*, then tells the full Moracat story
 * via the shared <MoracatStory> — the same content as the permanent /about page,
 * so onboarding and the evergreen page never drift. The cat is the hero (R009);
 * delight is warm, not a confetti cannon (R073).
 */
export default function WelcomePage() {
  return (
    <React.Suspense
      fallback={<div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}
    >
      <WelcomeInner />
    </React.Suspense>
  );
}

function WelcomeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const catId = params.get("cat");
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";

  const { data: cat, isLoading } = useQuery({
    queryKey: ["welcome-cat", catId],
    queryFn: () => authedFetch<WelcomeCat>(`/cats/${catId}`),
    enabled: !!user && !!catId,
  });

  const storyRef = React.useRef<HTMLDivElement>(null);
  const [shareBusy, setShareBusy] = React.useState(false);

  const name = cat?.name ?? (isAr ? "قطك" : "your cat");
  const firstName = user?.firstName;

  async function share() {
    if (!storyRef.current || !cat?.catIdNumber) return;
    setShareBusy(true);
    try {
      const outcome = await shareStoryPng(
        storyRef.current,
        `moracat-${cat.name}`.toLowerCase().replace(/\s+/g, "-"),
        isAr
          ? `${cat.name} رسمياً في عائلة مرقط 🐾 سوّ هوية قطك على moracat.co`
          : `${cat.name} is officially a Moracat 🐾 Create your cat's ID at moracat.co`
      );
      if (outcome === "downloaded") {
        toast({
          title: isAr ? "جاهزة للستوري ✨" : "Story ready ✨",
          description: isAr ? "حفظناها لك — ارفعها على انستقرام" : "Saved for you — post it to your Story",
          variant: "success",
        });
      }
    } catch {
      toast({ title: isAr ? "تعذّر إنشاء الستوري" : "Couldn't create the story", variant: "error" });
    } finally {
      setShareBusy(false);
    }
  }

  if (isLoading) {
    return <div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  const ContinueButton = (
    <Button onClick={() => router.push("/portal")} size="lg" className="w-full sm:w-auto">
      {isAr ? "أكمل إلى لوحتي" : "Continue to my dashboard"} <ArrowRight className="size-4 rtl:rotate-180" />
    </Button>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-16 pb-16">
      {/* ── Congratulatory hero — celebration + the real ID + Inactive framing ── */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-primary/[0.07] to-transparent p-8 sm:p-12">
        <IlloPaw tone="butter" className="pointer-events-none absolute -top-2 end-10 size-12 rotate-[16deg] opacity-40" />
        <IlloPaw tone="peach" className="pointer-events-none absolute bottom-6 start-8 size-9 rotate-[-12deg] opacity-40" />
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,20rem)]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" /> {isAr ? "لحظة مميزة" : "A moment worth marking"}
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {isAr
                ? `مبروك يا ${firstName ?? "صديقنا"} — ${name} انضم رسمياً إلى مرقط 🎉`
                : `Welcome, ${firstName ?? "friend"} — ${name} has officially joined Moracat 🎉`}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
              {isAr
                ? `${name} صار عنده هوية مرقط رسمية خاصة به. الهوية الآن «غير مفعّلة» لأنها لم تُربط بعضوية بعد — وعند إطلاق العضويات، تفعيلها يفتح ما هو أبعد بكثير من بطاقة تعريف.`
                : `${name} now has an official Moracat ID. Right now it's “Inactive” because it isn't connected to a membership yet — and when memberships launch, activating it unlocks far more than an identification card.`}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {cat?.catIdNumber && (
                <span className="inline-flex items-center gap-2 rounded-xl bg-card px-3 py-2 font-mono text-sm shadow-e1">
                  <IdCard className="size-4 text-primary" /> {cat.catIdNumber}
                </span>
              )}
              <Badge variant="secondary" dot><Clock className="size-3.5" /> {isAr ? "غير مفعّلة" : "Inactive"}</Badge>
            </div>
            {/* Primary next step — bring the new member to life. Framed as a gift
                to the cat (R017), it flows straight into the profile journey. */}
            <div className="mt-6 flex flex-wrap gap-3">
              {catId ? (
                <Button onClick={() => router.push(`/portal/cats/new?cat=${catId}`)} size="lg" className="w-full sm:w-auto">
                  <Sparkles className="size-4" /> {isAr ? `عرّفنا على ${name} أكثر` : `Bring ${name} to life`} <ArrowRight className="size-4 rtl:rotate-180" />
                </Button>
              ) : ContinueButton}
              <Button onClick={share} loading={shareBusy} disabled={!cat?.catIdNumber} variant="secondary" size="lg">
                <Share2 className="size-4" /> {isAr ? `شارك هوية ${name}` : `Share ${name}'s ID`}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {isAr
                ? "أضف شخصيته ومفضّلاته، وصمّم بطاقته بالثيمات والملصقات — دقيقتان تخلّي هويته تشبهه."
                : "Add their personality & favourites, and style their card with themes and stickers — two minutes to make the ID truly theirs."}
            </p>
            {catId && (
              <button
                onClick={() => router.push("/portal")}
                className="mt-2 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {isAr ? "لاحقاً — أكمل إلى لوحتي" : "Later — continue to my dashboard"}
              </button>
            )}
          </div>

          {/* The real card — the hero of the moment. */}
          <div className="relative mx-auto w-full max-w-xs">
            <Sticker rotate={10} float className="-end-4 -top-5 hidden sm:block">
              <IlloHeart tone="pink" className="size-8" />
            </Sticker>
            {cat?.catIdNumber ? (
              <CatIdCard catName={cat.name} catIdNumber={cat.catIdNumber} issuedAt={cat.idIssuedAt} photoUrl={cat.photoUrl} qrToken={cat.qrToken} isAr={isAr} />
            ) : (
              <CatIdCard catName={name} catIdNumber="MRC-····-····" isAr={isAr} preview />
            )}
          </div>
        </div>
      </section>

      {/* ── The full Moracat story (shared single source of truth) ────────────── */}
      <MoracatStory isAr={isAr} catName={cat?.name} variant="onboarding" />

      {/* ── Final CTA ─────────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card p-8 text-center shadow-e1 sm:p-12">
        <h2 className="font-display text-2xl font-bold tracking-tight">
          {isAr ? "هويتك جاهزة، ورحلتك بدأت" : "Your ID is ready, and your journey has begun"}
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {isAr ? "سنعلمك أول ما تصبح العضوية متاحة. حتى ذلك الحين، الهوية والمجتمع لك." : "We'll tell you the moment membership becomes available. Until then, the ID and community are yours."}
        </p>
        <div className="mt-1">{ContinueButton}</div>
      </section>

      {/* Hidden 9:16 story node, captured on Share (kept off-screen). */}
      {cat?.catIdNumber && (
        <div className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
          <div ref={storyRef}>
            <CatIdStory catName={cat.name} catIdNumber={cat.catIdNumber} issuedAt={cat.idIssuedAt} photoUrl={exportSafeSrc(cat.photoUrl)} qrToken={cat.qrToken} isAr={isAr} />
          </div>
        </div>
      )}
    </div>
  );
}
