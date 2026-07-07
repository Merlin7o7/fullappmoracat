"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Compass,
  Share2,
  ArrowRight,
  ShieldCheck,
  HeartHandshake,
  QrCode,
  Users,
  Eye,
  Sparkles,
  IdCard,
  Stethoscope,
  Lock,
} from "lucide-react";
import { Card, Button, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { CatIdCard } from "@/components/cat-id-card";
import { CatIdStory } from "@/components/cat-id-story";
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
 * a member issues a Cat ID (routed here from the ceremony; never auto-shown
 * again — see cats.service `onboardedAt`). It congratulates, explains the
 * Moracat ecosystem, and hands off to the three things worth doing next. The cat
 * is the hero throughout (R009); delight is warm, not a confetti cannon (R073).
 */
export default function WelcomePage() {
  return (
    <React.Suspense
      fallback={
        <div className="grid place-items-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
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
      toast({
        title: isAr ? "تعذّر إنشاء الستوري" : "Couldn't create the story",
        variant: "error",
      });
    } finally {
      setShareBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-12 pb-16">
      {/* ── Congratulatory hero ─────────────────────────────────────────── */}
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
                ? `مبروك يا ${firstName ?? "صديقنا"} — ${name} صار عضواً رسمياً 🎉`
                : `Welcome, ${firstName ?? "friend"} — ${name} is officially a member 🎉`}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
              {isAr
                ? `${name} صار عنده هوية مرقط خاصة به — رقم فريد، سجل يتبعه أينما ذهب، ومكان في مجتمع محبّي القطط. خلّنا نعرّفك على اللي صار بين يديك.`
                : `${name} now has a Moracat ID of their own — a unique number, a record that follows them anywhere, and a place in a community of cat people. Here's what you're now holding.`}
            </p>
            {cat?.catIdNumber && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-card px-3 py-2 font-mono text-sm shadow-e1">
                <IdCard className="size-4 text-primary" />
                {cat.catIdNumber}
              </p>
            )}
          </div>

          {/* The real card — the hero of the moment. */}
          <div className="relative mx-auto w-full max-w-xs">
            <Sticker rotate={10} float className="-end-4 -top-5 hidden sm:block">
              <IlloHeart tone="pink" className="size-8" />
            </Sticker>
            {cat?.catIdNumber ? (
              <CatIdCard
                catName={cat.name}
                catIdNumber={cat.catIdNumber}
                issuedAt={cat.idIssuedAt}
                photoUrl={cat.photoUrl}
                qrToken={cat.qrToken}
                isAr={isAr}
              />
            ) : (
              <CatIdCard catName={name} catIdNumber="MRC-····-····" isAr={isAr} preview />
            )}
          </div>
        </div>
      </section>

      {/* ── What Moracat is (the ecosystem) ─────────────────────────────── */}
      <section>
        <SectionHead
          eyebrow={isAr ? "نظام مرقط" : "The Moracat ecosystem"}
          title={isAr ? "أكثر من مجرد تطبيق — إنه انتماء" : "More than an app — it's belonging"}
          sub={
            isAr
              ? "مرقط عضوية لأصحاب القطط الجادين: هوية رسمية لكل قط، سجل صحي يرافقه، ومجتمع تشارك فيه فخرك."
              : "Moracat is a membership for people who take their cats seriously: an official identity for each cat, a health record that travels with them, and a community to share the pride."
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <MiniCard icon={IdCard} tone="text-primary" title={isAr ? "هوية" : "Identity"} body={isAr ? "رقم فريد وبطاقة تُفخر بها." : "A unique number and a card to be proud of."} />
          <MiniCard icon={Stethoscope} tone="text-leaf" title={isAr ? "سجل" : "Record"} body={isAr ? "تطعيمات ووزن وملاحظات — في مكان واحد." : "Vaccines, weight, and notes — in one place."} />
          <MiniCard icon={Users} tone="text-accent" title={isAr ? "مجتمع" : "Community"} body={isAr ? "اكتشف قططاً، وشارك قطك، واجمع الإعجابات." : "Discover cats, share yours, and gather love."} />
        </div>
      </section>

      {/* ── The Cat ID and its jobs ─────────────────────────────────────── */}
      <section>
        <SectionHead
          eyebrow={isAr ? "هوية القط" : "The Cat ID"}
          title={isAr ? "بطاقة تؤدي أربع مهام حقيقية" : "A card that does four real jobs"}
          sub={isAr ? "ليست بطاقة زينة — كل مهمة منها تعتني بـ" + " " + name + "." : `Never a vanity card — each job looks after ${name}.`}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <JobCard icon={ShieldCheck} title={isAr ? "الأمان" : "Safety"} body={isAr ? "لو ضاع، هويته تقود من يلقاه إليك." : "If they're ever lost, their ID leads a finder back to you."} />
          <JobCard icon={Stethoscope} title={isAr ? "الصحة" : "Health"} body={isAr ? "سجله الصحي حاضر لأي عيادة شريكة." : "Their health record, ready for any partner clinic."} />
          <JobCard icon={IdCard} title={isAr ? "الهوية" : "Identity"} body={isAr ? "اسمه ورقمه وصورته — من هو، بوضوح." : "Their name, number, and photo — who they are, clearly."} />
          <JobCard icon={HeartHandshake} title={isAr ? "القيمة" : "Value"} body={isAr ? "مزايا العضوية قريباً — نُبقيك على اطّلاع." : "Membership benefits are coming soon — we'll keep you posted."} />
        </div>
      </section>

      {/* ── QR + digital identity ───────────────────────────────────────── */}
      <section className="grid items-center gap-6 rounded-3xl border border-border bg-card p-8 sm:grid-cols-[auto_1fr]">
        <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <QrCode className="size-10" />
        </div>
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight">
            {isAr ? "رمز QR وهوية رقمية آمنة" : "A QR code and a secure digital identity"}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? "كل بطاقة تحمل رمز QR خاصاً — ليس رابطاً عاماً، بل رمزاً مشفّراً لا يكشف بياناتك. العيادات والشركاء المعتمدون فقط يقدرون يتحققون من هوية قطك وعضويته عبره. تقدر تنزّل البطاقة PDF، أو تحفظها في محفظة جوالك، أو تطبعها."
              : "Every card carries its own QR — not a public link, but an encrypted token that reveals nothing about you. Only Moracat and authorised partners can verify your cat's identity and membership through it. You can download the card as a PDF, save it to your phone's wallet, or print it."}
          </p>
        </div>
      </section>

      {/* ── Community + privacy ─────────────────────────────────────────── */}
      <section>
        <SectionHead
          eyebrow={isAr ? "المجتمع" : "The community"}
          title={isAr ? "شارك فخرك — بشروطك أنت" : "Share your pride — on your terms"}
          sub={
            isAr
              ? "اجعل ملف قطك عاماً ليظهر في المجتمع، حيث يكتشفه الآخرون، ويجمع الإعجابات، ويتصدّر الأكثر محبوبية."
              : "Make your cat's profile public to appear in the community, where others discover them, hearts add up, and the most-loved cats rise to the top."
          }
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <MiniCard icon={Users} tone="text-accent" title={isAr ? "اكتشاف ومشاركة" : "Discover & share"} body={isAr ? "تصفّح قططاً حسب الفصيلة والمدينة، وشارك رابط قطك." : "Browse cats by breed and city, and share your cat's link."} />
          <MiniCard icon={HeartHandshake} tone="text-blush" title={isAr ? "إعجابات وترتيب" : "Likes & rankings"} body={isAr ? "اجمع الإعجابات وتابع «الأكثر محبوبية»." : "Gather likes and follow the “Most Loved” ranking."} />
          <MiniCard icon={Eye} tone="text-leaf" title={isAr ? "خصوصية دقيقة" : "Fine-grained privacy"} body={isAr ? "تحكّم في كل حقل: الاسم، المدينة، العمر، المعرض." : "Control every field: name, city, age, gallery."} />
          <MiniCard icon={Lock} tone="text-primary" title={isAr ? "خاص افتراضياً" : "Private by default"} body={isAr ? "لا شيء يُنشر حتى تختار أنت المشاركة." : "Nothing is public until you choose to share."} />
        </div>
      </section>

      {/* ── Memberships coming soon (honest — R040) ─────────────────────── */}
      <section className="flex flex-col items-start gap-3 rounded-3xl border border-dashed border-primary/30 bg-primary/[0.04] p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Lock className="size-3.5" /> {isAr ? "قريباً" : "Coming soon"}
        </span>
        <h3 className="font-display text-xl font-semibold tracking-tight">
          {isAr ? "العضويات المدفوعة في الطريق" : "Paid memberships are on the way"}
        </h3>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "هوية قطك ومجتمعه متاحان لك الآن مجاناً. المزايا المدفوعة — الأسعار العضوية والعناية — نجهّزها بعناية، ونعلمك أول ما تنطلق."
            : "Your cat's ID and community are yours now, free. The paid benefits — member rates and care — are being prepared with care, and we'll tell you the moment they launch."}
        </p>
        <Link href="/portal/subscribe">
          <Button variant="secondary" size="sm">
            {isAr ? "استعرض العضويات" : "Preview memberships"} <ArrowRight className="size-4 rtl:rotate-180" />
          </Button>
        </Link>
      </section>

      {/* ── The three next steps (clear CTAs) ───────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-center font-display text-2xl font-bold tracking-tight">
          {isAr ? "وش الخطوة الجاية؟" : "What next?"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <CtaCard
            icon={Share2}
            title={isAr ? `شارك هوية ${name}` : `Share ${name}'s Cat ID`}
            body={isAr ? "صمّمنا لك ستوري جاهزاً للنشر." : "We made you a ready-to-post Story."}
            action={
              <Button onClick={share} loading={shareBusy} disabled={!cat?.catIdNumber} className="w-full">
                <Share2 className="size-4" /> {isAr ? "شارك الآن" : "Share now"}
              </Button>
            }
          />
          <CtaCard
            icon={Compass}
            title={isAr ? "استكشف المجتمع" : "Explore the community"}
            body={isAr ? "شوف قطط الأعضاء وأعجب بها." : "Meet members' cats and give some love."}
            action={
              <Link href="/community" className="block">
                <Button variant="secondary" className="w-full">
                  <Compass className="size-4" /> {isAr ? "افتح المجتمع" : "Open community"}
                </Button>
              </Link>
            }
          />
          <CtaCard
            icon={IdCard}
            title={isAr ? `أكمل ملف ${name}` : `Complete ${name}'s profile`}
            body={isAr ? "أضف تفاصيله الصحية — كلها اختيارية." : "Add their health details — all optional."}
            action={
              <Link href={catId ? `/portal/cats/new?cat=${catId}` : "/portal/cats"} className="block">
                <Button variant="secondary" className="w-full">
                  <IdCard className="size-4" /> {isAr ? "أكمل الملف" : "Complete profile"}
                </Button>
              </Link>
            }
          />
        </div>
        <div className="pt-2 text-center">
          <button
            onClick={() => router.push("/portal")}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {isAr ? "تخطَّ إلى لوحتي" : "Skip to my dashboard"}
          </button>
        </div>
      </section>

      {/* Hidden 9:16 story node, captured on Share (kept off-screen). */}
      {cat?.catIdNumber && (
        <div className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
          <div ref={storyRef}>
            <CatIdStory
              catName={cat.name}
              catIdNumber={cat.catIdNumber}
              issuedAt={cat.idIssuedAt}
              // Route R2 photos through same-origin /_next/image so html-to-image
              // can capture them (cross-origin photos otherwise fail the export).
              photoUrl={exportSafeSrc(cat.photoUrl)}
              qrToken={cat.qrToken}
              isAr={isAr}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Small presentational helpers ──────────────────────────────────────── */

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="mb-5 max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{sub}</p>
    </div>
  );
}

function MiniCard({
  icon: Icon,
  title,
  body,
  tone = "text-primary",
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  tone?: string;
}) {
  return (
    <Card className="flex flex-col gap-2 p-5">
      <Icon className={`size-6 ${tone}`} />
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </Card>
  );
}

function JobCard({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <h3 className="font-display text-base font-semibold">{title}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </Card>
  );
}

function CtaCard({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3 p-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </span>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-auto pt-1">{action}</div>
    </Card>
  );
}
