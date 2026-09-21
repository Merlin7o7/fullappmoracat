"use client";

import * as React from "react";
import {
  Package, Stethoscope, Heart, Sparkles, Users, IdCard, ShieldCheck,
  Clock, Check, Star, HeartPulse, PawPrint,
} from "lucide-react";
import { Card, Badge, cn } from "@moraqat/ui";
import { IlloCat, IlloPaw, IlloHeart, Sticker } from "@/components/illustrations";

/**
 * "What is Moracat?" — the single source of truth for the product story.
 *
 * Rendered both by the public /about page (server) and the first-run portal
 * welcome page (client), so the onboarding intro and the permanent page never
 * drift. Presentational only: takes `isAr` (no internal locale hook) so it works
 * inside a server component; entrances use CSS `animate-fade-up`, which already
 * honours prefers-reduced-motion via the global rule (R075).
 *
 * The throughline: the Cat ID is the beginning of the journey; the Membership is
 * what activates its full value. Inactive is intentional and premium, never an
 * error (R040 honesty, R006).
 */
export interface MoracatStoryProps {
  isAr: boolean;
  /** Personalises the ID-status section, e.g. "Luna's Moracat ID is Inactive". */
  catName?: string;
  /** Whether the member's ID is already activated (false during the beta). */
  membershipActive?: boolean;
  /** Onboarding omits the top intro hero (the welcome page already greeted). */
  variant?: "page" | "onboarding";
  className?: string;
}

export function MoracatStory({ isAr, catName, membershipActive = false, variant = "page", className }: MoracatStoryProps) {
  const name = catName?.trim() || (isAr ? "قطك" : "your cat");

  return (
    <div className={cn("space-y-16 sm:space-y-24", className)}>
      {variant === "page" && <IntroHero isAr={isAr} />}

      {/* 2 — More than just an ID */}
      <Section
        eyebrow={isAr ? "أكثر من مجرد هوية" : "More than just an ID"}
        title={isAr ? "الهوية هي البداية" : "The ID is where it starts"}
        lead={
          isAr
            ? "تعرفنا من هوية قطك — بس الهوية مو بطاقة وبس. هي اللي ترجّعه لك لو ضاع، وتحفظ سجله الصحي، وتعرّف الناس عليه."
            : "You meet Moracat through your cat's ID — but the ID isn't just a card. It's what brings them home if they're lost, keeps their health record, and tells people who they are."
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <MiniCard icon={IdCard} tone="text-primary" title={isAr ? "هوية" : "Identity"} body={isAr ? "رقم يخصّه وحده، وبطاقة تبقى معه طول عمره." : "A number that is theirs alone, and a card for life."} />
          <MiniCard icon={Stethoscope} tone="text-leaf" title={isAr ? "عناية" : "Care"} body={isAr ? "سجل صحي يمشي معه لأي عيادة — وأنت من يقرّر من يشوفه." : "A health record that goes to any clinic with them — and you decide who sees it."} />
          <MiniCard icon={Users} tone="text-accent" title={isAr ? "مجتمع" : "Community"} body={isAr ? "أهل القطط في السعودية — تبنٍّ، ومفقود وموجود، وقطط تعرفها." : "Saudi cat people — adoption, Lost & Found, and cats you get to know."} />
        </div>
      </Section>

      {/* 3 — What membership unlocks */}
      <Section
        eyebrow={isAr ? "وش فيه اليوم، ووش الجاي" : "What's here today, and what's coming"}
        title={isAr ? "نقول لك بصدق وين وصلنا" : "An honest account of where we are"}
        lead={
          isAr
            ? "الهوية والسجل الصحي والمجتمع شغّالة اليوم، مجاناً. خطة العناية الشهرية وأسعار الشركاء قيد التجهيز — وما نعد بشي قبل ما يجهز."
            : "The ID, the health record and the community work today, free. The monthly care plan and partner rates are being built — and we don't promise anything before it's ready."
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <BenefitCard
            icon={Package}
            title={isAr ? "خطة العناية الشهرية — قريباً" : "The monthly care plan — coming"}
            items={isAr ? ["أكل ورمل ومكافآت على مقاس قطك", "توصل لبابك كل شهر", "اختيارية — والهوية تظل مجانية"] : ["Food, litter and treats sized to your cat", "At your door every month", "Optional — the ID stays free"]}
          />
          <BenefitCard
            icon={Stethoscope}
            title={isAr ? "أسعار الأعضاء عند الشركاء — نوقّع الآن" : "Member rates at partners — signing now"}
            // Member-rate lexicon (R085/R087): recognition, not coupon talk.
            items={isAr ? ["عيادات وعناية ومتاجر نختارها بعناية", "يظهر كل شريك أول ما يجهز", "نبلّغ الأعضاء أول بأول"] : ["Clinics, grooming and shops we choose carefully", "Each partner appears the day it's ready", "Members hear first"]}
          />
          <BenefitCard
            icon={Heart}
            title={isAr ? "المجتمع — شغّال اليوم" : "Community — live today"}
            items={isAr ? ["صفحة لقطك باسمه وصورته", "تبنَّ قطاً أو اعرض قطاً للتبنّي", "مفقود وموجود", "خاص بضغطة متى ما تبي"] : ["A page for your cat, with their name and photo", "Adopt a cat, or rehome one", "Lost & Found", "Private in one tap, whenever you like"]}
          />
          <BenefitCard
            icon={HeartPulse}
            title={isAr ? "السجل الصحي — شغّال اليوم" : "The health record — live today"}
            items={isAr ? ["التطعيمات ومواعيدها", "زيارات العيادة وملاحظات الطبيب", "تذكير قبل موعد التطعيم", "العيادة تشوف السجل بإذنك فقط"] : ["Vaccinations and when they're due", "Clinic visits and the vet's notes", "A reminder before a vaccine is due", "A clinic sees the record only with your permission"]}
          />
        </div>
      </Section>

      {/* 4 — Your Moracat ID: Inactive vs Active */}
      <Section
        eyebrow={isAr ? "هوية قطك" : "Your Moracat ID"}
        title={isAr ? "الهوية مجانية دايماً — والخطة اختيارية" : "The ID is free for good — the plan is optional"}
        lead={
          isAr
            ? `${catName ? `هوية ${name}` : "هوية قطك"} كاملة من أول يوم: رقمها وسجلها الصحي وصفحتها لك بلا مقابل، اليوم ودايماً. خطة العناية الشهرية شي منفصل تختاره لو حبّيت.`
            : `${catName ? `${name}'s ID` : "Your cat's ID"} is complete from day one: the number, the health record and the page are yours at no cost, today and always. The monthly care plan is a separate thing you may choose to add.`
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <StatusCard
            active={false}
            highlighted={!membershipActive}
            isAr={isAr}
            label={isAr ? "الهوية — لك الآن" : "The ID — yours now"}
            body={
              isAr
                ? "الرقم والبطاقة والسجل الصحي وصفحة المجتمع ومفقود وموجود — كلها شغّالة ومجانية، وما تنسحب منك لو ما اشتركت."
                : "The number, the card, the health record, the community page and Lost & Found — all working and free, and never taken away if you don't subscribe."
            }
          />
          <StatusCard
            active
            highlighted={membershipActive}
            isAr={isAr}
            label={isAr ? "مع خطة العناية" : "With the care plan"}
            body={
              isAr
                ? "تضيف فوق الهوية: عناية قطك الشهرية توصل لبابك، وسعر الأعضاء عند الشركاء أول ما ينضمون."
                : "Adds to the ID: your cat's monthly care at your door, and member rates at partners as they join."
            }
          />
        </div>
      </Section>

      {/* 5 — Why we're starting this way (Community Beta) */}
      <section className="animate-fade-up overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/[0.06] to-transparent p-8 sm:p-12">
        <div className="mx-auto max-w-2xl text-center">
          <Sticker rotate={-8} float className="mx-auto mb-4 w-fit">
            <IlloHeart tone="pink" className="size-9" />
          </Sticker>
          <Badge variant="secondary" className="mb-3">{isAr ? "مجتمع مرقط — نسخة مبكرة" : "Moracat — Community Beta"}</Badge>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {isAr ? "أول ١٠٠٠ قط هم الأعضاء المؤسِّسون" : "The first 1,000 cats are the Founding Members"}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {isAr
              ? "مرقط في بدايته، واللي ينضم الحين يساعدنا نبنيه صح. أرقام الهويات متسلسلة فعلاً: أول ١٠٠٠ قط يتسجّل يحمل صفة «عضو مؤسِّس» في هويته دايماً — الصفة تجي من رقم قطك نفسه، مو شي نعطيه أو نسحبه."
              : "Moracat is at its beginning, and those who join now help us build it right. Cat ID numbers are genuinely sequential: the first 1,000 cats registered carry “Founding Member” on their ID for good — the status comes from your cat's own number, not something we hand out or take away."}
          </p>
        </div>
      </section>

      {/* 6 — Our vision */}
      <Section
        eyebrow={isAr ? "رؤيتنا" : "Our vision"}
        title={isAr ? "منظومة واحدة لكل ما يخص قطك" : "One ecosystem for everything your cat needs"}
        lead={
          isAr
            ? "نبي كل قط في السعودية يكون له مكان واحد يجمع حياته: هويته، وسجله الصحي، وعنايته، وناسه — من أول يوم له في البيت إلى آخره."
            : "We want every cat in Saudi Arabia to have one place that holds their whole life: their identity, their health record, their care and their people — from their first day at home to their last."
        }
      >
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { icon: IdCard, en: "Identity", ar: "الهوية" },
            { icon: Stethoscope, en: "Care", ar: "العناية" },
            { icon: Users, en: "Community", ar: "المجتمع" },
            { icon: Sparkles, en: "And beyond", ar: "وما بعدها" },
          ].map((v) => (
            <div key={v.en} className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
              <v.icon className="size-5 shrink-0 text-primary" />
              <span className="text-sm font-medium">{isAr ? v.ar : v.en}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ── Sections & cards ─────────────────────────────────────────────────────── */

function IntroHero({ isAr }: { isAr: boolean }) {
  return (
    <section className="animate-fade-up relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-cream/60 to-transparent p-8 text-center sm:p-14 dark:from-cream/20">
      <IlloPaw tone="butter" className="pointer-events-none absolute -top-2 end-10 size-12 rotate-[16deg] opacity-40" />
      <IlloPaw tone="peach" className="pointer-events-none absolute bottom-6 start-8 size-9 rotate-[-12deg] opacity-40" />
      <Sticker rotate={10} float className="mx-auto mb-4 w-fit">
        <IlloCat tone="green" className="h-16 w-auto sm:h-20" />
      </Sticker>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        <PawPrint className="size-3.5" /> {isAr ? "ما هو مرقط؟" : "What is Moracat?"}
      </span>
      <h1 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
        {isAr ? "نبني مستقبل تربية القطط" : "We're building the future of cat ownership"}
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        {isAr
          ? "كل قط يحصل على هوية رقمية فريدة عبر مرقط — تصبح هويته داخل منظومة مرقط، والبداية لرحلة أكبر."
          : "Every cat receives a unique digital identity through its Moracat ID — their identity inside the Moracat ecosystem, and the beginning of a bigger journey."}
      </p>
    </section>
  );
}

function Section({
  eyebrow, title, lead, children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-fade-up">
      <div className="mx-auto mb-6 max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{lead}</p>
      </div>
      {children}
    </section>
  );
}

function MiniCard({ icon: Icon, title, body, tone = "text-primary" }: { icon: React.ElementType; title: string; body: string; tone?: string }) {
  return (
    <Card className="flex flex-col items-center gap-2 p-6 text-center">
      <Icon className={cn("size-7", tone)} />
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </Card>
  );
}

function BenefitCard({ icon: Icon, title, items }: { icon: React.ElementType; title: string; items: string[] }) {
  return (
    <Card className="flex flex-col gap-4 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-e2">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
          <Icon className="size-5" />
        </span>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h3>
      </div>
      <ul className="grid gap-2">
        {items.map((it) => (
          <li key={it} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="size-4 shrink-0 text-leaf" aria-hidden /> {it}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StatusCard({ active, highlighted, isAr, label, body }: { active: boolean; highlighted: boolean; isAr: boolean; label: string; body: string }) {
  return (
    <Card
      className={cn(
        "relative flex flex-col gap-3 p-6",
        highlighted ? (active ? "border-success/40 bg-success/[0.04]" : "border-primary/40 bg-primary/[0.04]") : "opacity-90",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-display text-lg font-semibold">
          {active ? <Star className="size-5 text-success" /> : <Clock className="size-5 text-primary" />}
          {label}
        </span>
        {highlighted && (
          <Badge variant={active ? "success" : "secondary"} dot>{isAr ? "حالتك الآن" : "You are here"}</Badge>
        )}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      {!active && (
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
          <ShieldCheck className="size-3.5" /> {isAr ? "مجانية اليوم ودايماً" : "Free today and always"}
        </p>
      )}
    </Card>
  );
}
