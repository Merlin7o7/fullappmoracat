"use client";

import * as React from "react";
import {
  Package, Stethoscope, Heart, Sparkles, Users, IdCard, ShieldCheck,
  Clock, Check, Star, Rocket, PawPrint,
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
        title={isAr ? "الهوية هي البداية — العضوية هي القيمة" : "The ID is the beginning — the membership is the value"}
        lead={
          isAr
            ? "نعرّفك على مرقط من خلال هوية قطك، لكن مرقط أكبر من بطاقة تعريف. إنها عضوية كاملة مبنية لجعل تربية القطط أسهل وأوفر وأكثر متعة."
            : "We introduce Moracat through your cat's ID — but Moracat is far more than an identification card. It's a complete membership built to make cat ownership easier, more affordable, and more rewarding."
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <MiniCard icon={IdCard} tone="text-primary" title={isAr ? "هوية" : "Identity"} body={isAr ? "رقم فريد وبطاقة رقمية دائمة لقطك." : "A unique number and a permanent digital card."} />
          <MiniCard icon={Stethoscope} tone="text-leaf" title={isAr ? "عناية" : "Care"} body={isAr ? "سجل صحي وأساسيات تصل إلى بابك." : "A health record and essentials at your door."} />
          <MiniCard icon={Users} tone="text-accent" title={isAr ? "مجتمع" : "Community"} body={isAr ? "انتماء إلى محبّي القطط في السعودية." : "Belonging among cat people in Saudi."} />
        </div>
      </Section>

      {/* 3 — What membership unlocks */}
      <Section
        eyebrow={isAr ? "ماذا تفتح العضوية" : "What membership unlocks"}
        title={isAr ? "عضوية واحدة، عالم من المزايا" : "One membership, a world of benefits"}
        lead={
          isAr
            ? "عند إطلاق العضويات، تفعيل هوية قطك يفتح ما هو أبعد من بطاقة تعريف."
            : "When memberships launch, activating your cat's ID unlocks far more than an identification card."
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <BenefitCard
            icon={Package}
            emoji="🐱"
            title={isAr ? "أساسيات شهرية" : "Monthly essentials"}
            items={isAr ? ["طعام", "رمل", "مكافآت", "إكسسوارات", "منتجات صحية"] : ["Food", "Litter", "Treats", "Accessories", "Health products"]}
          />
          <BenefitCard
            icon={Stethoscope}
            emoji="🏥"
            title={isAr ? "مزايا الشركاء" : "Partner benefits"}
            items={isAr ? ["خصومات بيطرية", "عروض الشركاء", "ترويجات حصرية"] : ["Veterinary discounts", "Partner offers", "Exclusive promotions"]}
          />
          <BenefitCard
            icon={Heart}
            emoji="❤️"
            title={isAr ? "المجتمع" : "Community"}
            items={isAr ? ["ملف قطك", "استعراض المجتمع", "المشاركة", "مسابقات قادمة", "تقدير وتميّز"] : ["Your cat profile", "Community showcase", "Sharing", "Future competitions", "Recognition"]}
          />
          <BenefitCard
            icon={Rocket}
            emoji="🚀"
            title={isAr ? "خدمات مستقبلية" : "Future services"}
            items={isAr ? ["مزايا جديدة للأعضاء", "شبكة شركاء", "تتبّع الصحة", "مزايا مرقط الإضافية"] : ["New member benefits", "Partner network", "Health tracking", "More Moracat features"]}
          />
        </div>
      </Section>

      {/* 4 — Your Moracat ID: Inactive vs Active */}
      <Section
        eyebrow={isAr ? "هوية قطك" : "Your Moracat ID"}
        title={isAr ? "حالتان، وكلاهما مقصود" : "Two statuses, both intentional"}
        lead={
          isAr
            ? `${catName ? `هوية ${name}` : "هويتك"} جاهزة الآن. تبدأ الهوية «غير مفعّلة» حتى تُربط بعضوية مرقط — وهذا اختيار، لا خطأ.`
            : `${catName ? `${name}'s ID` : "Your ID"} is ready now. It begins as “Inactive” until it's connected to a Moracat Membership — that's by design, not a limitation.`
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <StatusCard
            active={false}
            highlighted={!membershipActive}
            isAr={isAr}
            label={isAr ? "غير مفعّلة" : "Inactive"}
            body={
              isAr
                ? "قطك يملك هوية مرقط رسمية، لكن العضوية لم تُفعّل بعد. الهوية والمجتمع لك الآن — مجاناً."
                : "Your cat has an official Moracat ID, but membership hasn't been activated yet. The ID and community are yours now — free."
            }
          />
          <StatusCard
            active
            highlighted={membershipActive}
            isAr={isAr}
            label={isAr ? "مفعّلة" : "Active"}
            body={
              isAr
                ? "العضوية مفعّلة، وكل المزايا مفتوحة: التوصيل الشهري، خصومات الشركاء، والمكافآت الحصرية."
                : "Membership is active and every benefit is unlocked: monthly deliveries, partner discounts, and member-only rewards."
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
            {isAr ? "أنت من الأعضاء المؤسّسين" : "You're a founding member"}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {isAr
              ? "مرقط الآن في نسخته المجتمعية المبكرة. أنت تنضم مبكراً لتساعد في تشكيل المنصة قبل إطلاق العضوية الكاملة — لست في قائمة انتظار، بل من أوائل من بنوا مرقط."
              : "Moracat is in its Community Beta. You're joining early to help shape the platform before full membership launches — not a waiting customer, but one of the first who built Moracat."}
          </p>
        </div>
      </section>

      {/* 6 — Our vision */}
      <Section
        eyebrow={isAr ? "رؤيتنا" : "Our vision"}
        title={isAr ? "منظومة واحدة لكل ما يخص قطك" : "One ecosystem for everything your cat needs"}
        lead={
          isAr
            ? "نطمح أن يصبح مرقط المنصة الرائدة لأصحاب القطط — تجمع الهوية والعناية والمجتمع والراحة ومزايا الشركاء الموثوقين في منظومة واحدة راقية."
            : "Moracat aims to become the leading platform for cat owners — combining identity, care, community, convenience, and trusted partner benefits into one premium ecosystem."
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

function BenefitCard({ icon: Icon, emoji, title, items }: { icon: React.ElementType; emoji: string; title: string; items: string[] }) {
  return (
    <Card className="flex flex-col gap-4 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-e2">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
          <Icon className="size-5" />
        </span>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          <span aria-hidden className="me-1.5">{emoji}</span>{title}
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
          <ShieldCheck className="size-3.5" /> {isAr ? "التفعيل متاح قريباً" : "Activation available soon"}
        </p>
      )}
    </Card>
  );
}
