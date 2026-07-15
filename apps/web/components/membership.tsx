"use client";

/**
 * Membership conversion surface — the bridge from an issued Cat ID to an active
 * membership (the core product). Two honest states, one component:
 *
 *  • Non-subscriber  → a warm "complete {cat}'s membership" card: what activating
 *    unlocks, an honest status pill, and one clear CTA. Commerce-aware — never a
 *    dead "Subscribe" link before launch (R006/R040): pre-launch it reads as
 *    "founding member, opens soon".
 *  • Subscriber      → the membership status card: plan, renewal, next box,
 *    benefits, manage/upgrade. No prompts once they've joined.
 *
 * The cat stays the hero (R009): copy is named after the cat, calm not pushy
 * (care, don't extract — P8), and the ask is singular (R005).
 */
import * as React from "react";
import Link from "next/link";
import {
  BadgeCheck, Package, Percent, Stethoscope, Users, Gift, ArrowRight,
  Sparkles, CalendarClock, Truck, Settings, Clock,
} from "lucide-react";
import { Button, Badge } from "@moraqat/ui";
import { localizeName } from "@/lib/translit";
import { formatDate } from "@/lib/datetime";
import { effectiveNextDelivery } from "@/lib/launch";
import { LaunchDeliveryNote } from "./launch-note";

export interface MembershipBenefit {
  icon: React.ComponentType<{ className?: string }>;
  en: string;
  ar: string;
}

/** What an active membership unlocks — the six pillars, cat-first framing. */
export const MEMBERSHIP_BENEFITS: MembershipBenefit[] = [
  { icon: BadgeCheck, en: "Official Cat ID activation", ar: "تفعيل هوية القط الرسمية" },
  { icon: Package, en: "Monthly essentials delivered", ar: "أساسيات شهرية توصل لبابك" },
  { icon: Percent, en: "Exclusive partner discounts", ar: "خصومات حصرية عند الشركاء" },
  { icon: Stethoscope, en: "Veterinary benefits", ar: "مزايا بيطرية" },
  { icon: Users, en: "Community perks", ar: "امتيازات في المجتمع" },
  { icon: Gift, en: "Future member rewards", ar: "مكافآت الأعضاء القادمة" },
];

export interface ActiveSubscription {
  plan: { nameEn: string; nameAr: string; tier: string } | null;
  price: number;
  nextDeliveryAt: string | null;
  nextBillingAt: string | null;
}

interface Props {
  isAr: boolean;
  /** True once payments are live (commerceEnabled()). */
  commerce: boolean;
  /** The member's active subscription, or null if they haven't joined. */
  subscription: ActiveSubscription | null;
  /** The cat in focus (for named, cat-first copy). */
  catName?: string | null;
  /** The focus cat's membership standing (drives the status pill). */
  membershipStatus?: "ACTIVE" | "INACTIVE" | "PENDING" | string | null;
  /** Deep-link target for the subscribe CTA (carries ?cat= when known). */
  subscribeHref?: string;
}

export function MembershipCard({
  isAr,
  commerce,
  subscription,
  catName,
  membershipStatus,
  subscribeHref = "/portal/subscribe",
}: Props) {
  const name = catName ? localizeName(catName, isAr ? "ar" : "en") : null;
  const fmt = (d: string | null) =>
    d ? formatDate(d, isAr ? "ar" : "en", { day: "numeric", month: "long", year: "numeric" }) : "—";

  // ── Subscriber: the membership status card ────────────────────────────────
  if (subscription) {
    const planName = subscription.plan
      ? isAr ? subscription.plan.nameAr : subscription.plan.nameEn
      : isAr ? "مخصّصة" : "Custom";
    return (
      <section className="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-e2 ring-hairline sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="success" className="gap-1">
              <BadgeCheck className="size-3.5" /> {isAr ? "عضوية فعّالة" : "Active membership"}
            </Badge>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
              {isAr ? `باقة ${planName}` : `${planName} plan`}
            </h2>
            {name && (
              <p className="mt-1 text-sm text-primary-foreground/85">
                {isAr ? `هوية ${name} مفعّلة رسمياً` : `${name}'s Cat ID is officially active`}
              </p>
            )}
          </div>
          <Sparkles className="size-6 text-primary-foreground/40" aria-hidden />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <StatTile icon={CalendarClock} label={isAr ? "التجديد" : "Renews"} value={fmt(subscription.nextBillingAt)} />
          {/* Pre-launch, the next box is the founding first-delivery date; after
              launch it's the member's real scheduled delivery. */}
          <StatTile
            icon={Truck}
            label={isAr ? "الصندوق القادم" : "Next box"}
            value={fmt(effectiveNextDelivery(subscription.nextDeliveryAt).date)}
          />
        </div>

        {/* Founding-member first-delivery reminder — retires after launch. */}
        <LaunchDeliveryNote isAr={isAr} variant="inline" className="mt-3 justify-start !text-primary-foreground/90" />

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/portal/subscriptions">
            <Button variant="glass" size="sm"><Settings className="size-4" /> {isAr ? "إدارة العضوية" : "Manage membership"}</Button>
          </Link>
          <Link href={subscribeHref}>
            <Button variant="glass" size="sm"><ArrowRight className="size-4 rtl:rotate-180" /> {isAr ? "ترقية الباقة" : "Upgrade plan"}</Button>
          </Link>
        </div>
      </section>
    );
  }

  // ── Non-subscriber: the "complete your membership" prompt ──────────────────
  const pending = membershipStatus === "PENDING";
  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-card to-card p-6 shadow-e1 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            {name
              ? isAr ? `أكمل عضوية ${name}` : `Complete ${name}'s membership`
              : isAr ? "أكمل عضويتك" : "Complete your membership"}
          </h2>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? `هوية ${name ?? "قطك"} صادرة — وتفعيلها بالعضوية يفتح العناية الشهرية والمزايا الكاملة.`
              : `${name ?? "Your cat"}'s ID is issued — activating it with a membership unlocks monthly care and the full benefits.`}
          </p>
        </div>
        <Badge variant="secondary" dot className="shrink-0">
          <Clock className="size-3.5" />
          {pending ? (isAr ? "قيد التفعيل" : "Pending") : (isAr ? "غير مفعّلة" : "Inactive")}
        </Badge>
      </div>

      {/* The six pillars — proof of value before the ask (R004). */}
      <ul className="mt-5 grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
        {MEMBERSHIP_BENEFITS.map((b) => (
          <li key={b.en} className="flex items-center gap-2.5 text-sm">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <b.icon className="size-4" />
            </span>
            <span className="text-foreground/90">{isAr ? b.ar : b.en}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {commerce ? (
          <Link href={subscribeHref}>
            <Button size="lg"><Sparkles className="size-4" /> {isAr ? "اشترك الآن" : "Subscribe now"} <ArrowRight className="size-4 rtl:rotate-180" /></Button>
          </Link>
        ) : (
          <>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Sparkles className="size-4" /> {isAr ? "أنت عضو مؤسّس — العضويات تُفتح قريباً" : "You're a founding member — memberships open soon"}
            </span>
          </>
        )}
      </div>
    </section>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: typeof Truck; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-primary-foreground/[0.08] p-3">
      <Icon className="size-4 shrink-0 text-primary-foreground/70" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-primary-foreground/70">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
