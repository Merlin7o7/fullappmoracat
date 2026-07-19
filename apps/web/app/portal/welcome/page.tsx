"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Share2, ArrowRight, Sparkles, IdCard, Clock, Check } from "lucide-react";
import { Button, Badge, useToast, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { commerceEnabled } from "@/lib/features";
import { PLANS } from "@/lib/plans";
import { CatIdCard } from "@/components/cat-id-card";
import { CatIdStory } from "@/components/cat-id-story";
import { MoracatStory } from "@/components/moracat-story";
import { MEMBERSHIP_BENEFITS } from "@/components/membership";
import { LaunchDeliveryNote } from "@/components/launch-note";
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
  const commerce = commerceEnabled();
  const subscribeHref = catId ? `/portal/subscribe?cat=${catId}` : "/portal/subscribe";

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
            {/* Primary next step — activate the membership (the core product).
                The Cat ID is the beginning of the journey, not the end. Honest
                about commerce mode: no dead "subscribe" link before launch. */}
            <div className="mt-6 flex flex-wrap gap-3">
              {commerce ? (
                <Button onClick={() => router.push(subscribeHref)} size="lg" className="w-full sm:w-auto">
                  <Sparkles className="size-4" /> {isAr ? `فعّل عضوية ${name}` : `Activate ${name}'s membership`} <ArrowRight className="size-4 rtl:rotate-180" />
                </Button>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary">
                  <Sparkles className="size-4" /> {isAr ? "أنت عضو مؤسّس — العضويات تُفتح قريباً" : "You're a founding member — memberships open soon"}
                </span>
              )}
              <Button onClick={share} loading={shareBusy} disabled={!cat?.catIdNumber} variant="secondary" size="lg">
                <Share2 className="size-4" /> {isAr ? `شارك هوية ${name}` : `Share ${name}'s ID`}
              </Button>
            </div>
            {/* Secondary paths — never block the celebration (leaving is easy, R010). */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {catId && (
                <button
                  onClick={() => router.push(`/portal/cats/new?cat=${catId}`)}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {isAr ? `خصّص ملف ${name}` : `Personalize ${name}'s profile`}
                </button>
              )}
              <button
                onClick={() => router.push("/portal")}
                className="font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {isAr ? "لاحقاً — إلى لوحتي" : "Later — go to my dashboard"}
              </button>
            </div>
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

      {/* ── Membership — the Cat ID is the beginning; the membership is the product ── */}
      <section className="space-y-8">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {isAr ? `وش تفتح عضوية ${name}؟` : `What ${name}'s membership unlocks`}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? "الهوية بداية الرحلة — العضوية تفعّلها وتفتح العناية الشهرية والمزايا الكاملة."
              : "The Cat ID is the beginning — a membership activates it and unlocks monthly care and the full benefits."}
          </p>
        </div>

        {/* The six pillars — value made visible before the ask (R004). */}
        <ul className="mx-auto grid max-w-2xl gap-x-6 gap-y-3 sm:grid-cols-2">
          {MEMBERSHIP_BENEFITS.map((b) => (
            <li key={b.en} className="flex items-center gap-3 text-sm">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><b.icon className="size-4" /></span>
              <span className="text-foreground/90">{isAr ? b.ar : b.en}</span>
            </li>
          ))}
        </ul>

        {/* The three plans — the recommendation is computed later from the cat;
            here we simply show what's on offer, priced, honestly.
            PLANS is a *static* import, so no server switch can suppress it —
            the gate has to live right here. While commerce is off we show no
            price, no tier name and no "most popular" (a tier table implies you
            can buy it — R006/R040). Flipping the flag restores it verbatim. */}
        {!commerce ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-border bg-cream/60 px-6 py-7 text-center dark:bg-cream/40">
            <p className="font-display text-lg font-bold">
              {isAr ? "العناية الشهرية تُفتح قريباً" : "Monthly care opens soon"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {isAr
                ? `نبني الآن العناية الشهرية على مقاس كل قط — حسب وزنه وعمره وبيته. ما راح نعرض عليك أسعاراً قبل ما تكون العناية جاهزة فعلاً، وأنت وسط ${name} أول من نخبرهم.`
                : `We're building monthly care sized to each cat — their weight, age, and household. We won't show you prices before the care is genuinely ready, and you and ${name} will be among the first we tell.`}
            </p>
          </div>
        ) : (
        <>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.tier} className={cn("relative rounded-2xl border bg-card p-5 shadow-e1", p.popular ? "border-primary ring-1 ring-primary/30" : "border-border")}>
              {p.popular && (
                <span className="absolute -top-2.5 start-4 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  {isAr ? "الأكثر شيوعاً" : "Most popular"}
                </span>
              )}
              <p className="font-display text-lg font-bold">{isAr ? p.nameAr : p.nameEn}</p>
              <p className="mt-1">
                <span className="font-display text-2xl font-bold tabular" dir="ltr">{p.price}</span>{" "}
                <span className="text-xs text-muted-foreground">{isAr ? "ر.س / شهرياً" : "SAR / month"}</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                {(isAr ? p.featuresAr : p.featuresEn).map((f) => (
                  <li key={f} className="flex items-baseline gap-1.5">
                    <Check className="size-3 shrink-0 translate-y-0.5 text-primary" aria-hidden /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {isAr
            ? "الحد الأدنى ٣ أشهر · تُدفع المدة مقدّماً عبر تمارا · بدون ضريبة"
            : "3-month minimum · pay the term upfront via Tamara · no VAT"}
        </p>
        </>
        )}

        {/* Founding-member launch note — first delivery date. */}
        <LaunchDeliveryNote isAr={isAr} className="mx-auto max-w-xl" />

        <div className="flex justify-center">
          {commerce ? (
            <Button onClick={() => router.push(subscribeHref)} size="lg">
              <Sparkles className="size-4" /> {isAr ? `فعّل عضوية ${name}` : `Activate ${name}'s membership`} <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary">
              <Sparkles className="size-4" /> {isAr ? "العضويات تُفتح قريباً — ستكون أول من يعرف" : "Memberships open soon — you'll be first to know"}
            </span>
          )}
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
