"use client";

// ════════════════════════════════════════════════════════════════════════
//  Product Introduction — "what Moracat actually is", shown right after the
//  Cat ID is issued and BEFORE the plan questionnaire.
//
//  Reframes the product: Moracat is first a PREMIUM MONTHLY SUBSCRIPTION for a
//  cat's everyday essentials; the Cat ID is one valuable benefit included with
//  it — never the product itself. Messaging hierarchy (owner-set):
//    1) Premium monthly essentials, delivered.
//    2) Personalized to your cat's needs.
//    3) Free physical + digital Cat ID included.
//    4) Member rates at partner vets & pet stores.
//    5) Community + future member benefits.
//  Visually rich, emotionally warm, value made undeniable before the ask (R004).
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Truck, SlidersHorizontal, IdCard, Stethoscope, Users, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { Badge, Button } from "@moraqat/ui";
import { IlloHeart, IlloPaw } from "@/components/illustrations";

interface Benefit {
  icon: React.ComponentType<{ className?: string }>;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  hero?: boolean;
  chipAr?: string;
  chipEn?: string;
}

const BENEFITS: Benefit[] = [
  {
    icon: Truck,
    hero: true,
    titleAr: "أساسيات قطك الشهرية، توصلك لباب البيت",
    titleEn: "Your cat's monthly essentials, delivered to your door",
    bodyAr: "طعام رطب وجاف، رمل، ومكافآت — مختارة بعناية وتصل في وقتها، بلا تفكير ولا نواقص.",
    bodyEn: "Wet & dry food, litter, and treats — hand-picked and delivered on time, so you never run out or overthink it.",
  },
  {
    icon: SlidersHorizontal,
    titleAr: "اشتراك مخصّص حسب احتياج قطك",
    titleEn: "A subscription personalized to your cat",
    bodyAr: "نسألك أسئلة بسيطة عن استهلاككم الشهري، ونرشّح لك الباقة المناسبة تماماً — لا أكثر ولا أقل.",
    bodyEn: "A few simple questions about what you use each month, and we recommend the box that fits exactly — no more, no less.",
  },
  {
    icon: IdCard,
    titleAr: "هوية قط رقمية وبطاقة فعلية — مجاناً",
    titleEn: "A digital Cat ID + physical card — free",
    bodyAr: "هوية رسمية لقطك تُعيده للبيت لو ضاع، وتحفظ سجله الصحي — مشمولة مع كل اشتراك.",
    bodyEn: "An official identity that brings your cat home if lost and keeps their health record — included with every subscription.",
    chipAr: "مزية مشمولة",
    chipEn: "Included benefit",
  },
  {
    icon: Stethoscope,
    titleAr: "أسعار الأعضاء عند العيادات والمتاجر",
    titleEn: "Member rates at partner vets & pet stores",
    bodyAr: "سعرك كعضو محفوظ عند شركائنا المؤسّسين — عيادات، فحوصات، ومستلزمات.",
    bodyEn: "Your member rate, honoured at our founding partners — clinics, check-ups, and supplies.",
  },
  {
    icon: Users,
    titleAr: "مجتمع ومزايا أعضاء قادمة",
    titleEn: "Community & member benefits ahead",
    bodyAr: "انضم لمجتمع أهل القطط، واحصل على مزايا حصرية تكبر مع عضويتك.",
    bodyEn: "Join a community of cat people, with exclusive perks that grow with your membership.",
  },
];

export function ProductIntro({
  isAr,
  catName,
  onStart,
  onSkip,
}: {
  isAr: boolean;
  catName?: string;
  onStart: () => void;
  onSkip?: () => void;
}) {
  const reduce = useReducedMotion();
  const Arrow = isAr ? ArrowLeft : ArrowRight;
  const name = catName || (isAr ? "قطك" : "your cat");
  const [hero, ...rest] = BENEFITS as [Benefit, ...Benefit[]];

  const rise = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: 0.05 * i, duration: 0.4, ease: "easeOut" as const },
        };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Hero: the subscription is the product ─────────────────────────── */}
      <motion.section
        {...rise(0)}
        className="relative overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/[0.12] via-background to-primary/[0.07] p-7 shadow-e2 sm:p-10"
      >
        <IlloHeart tone="pink" className="pointer-events-none absolute -top-3 end-5 size-12 rotate-[12deg] opacity-40" />
        <IlloPaw tone="butter" className="pointer-events-none absolute bottom-5 start-6 size-9 rotate-[-12deg] opacity-40" />
        <Badge variant="secondary" className="gap-1.5">
          <Truck className="size-3.5" />
          {isAr ? "اشتراك العناية الشهري" : "The monthly care subscription"}
        </Badge>
        <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {isAr ? hero.titleAr : hero.titleEn}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {isAr
            ? `مرقط ليست مجرد هوية — إنها خدمة عناية شهرية متكاملة لـ ${name}. الهوية واحدة من مزاياها.`
            : `Moracat isn't just an ID — it's a complete monthly care service for ${name}. The Cat ID is one of its benefits.`}
        </p>
      </motion.section>

      {/* ── The value stack — Cat ID sits as benefit #3, not the headline ─── */}
      <div className="grid gap-3 sm:grid-cols-2">
        {rest.map((b, i) => (
          <motion.div
            key={b.titleEn}
            {...rise(i + 1)}
            className="relative flex gap-3 rounded-2xl border border-border bg-card p-5 shadow-e1"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <b.icon className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-sm font-semibold">{isAr ? b.titleAr : b.titleEn}</p>
                {(b.chipEn || b.chipAr) && (
                  <Badge variant="success" className="gap-1 text-[10px]">
                    <Check className="size-2.5" /> {isAr ? b.chipAr : b.chipEn}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{isAr ? b.bodyAr : b.bodyEn}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── One clear action → the questionnaire ──────────────────────────── */}
      <motion.div {...rise(rest.length + 1)} className="flex flex-col items-center gap-3 pt-2">
        <Button size="lg" className="w-full sm:w-auto" onClick={onStart}>
          {isAr ? `لنجد باقة ${name} المثالية` : `Find ${name}'s perfect plan`}
          <Arrow className="size-4" />
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {isAr ? "٤ أسئلة سريعة عن استهلاككم الشهري — أقل من دقيقة" : "4 quick questions about your monthly use — under a minute"}
        </p>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {isAr ? "لاحقاً" : "Maybe later"}
          </button>
        )}
      </motion.div>
    </div>
  );
}
