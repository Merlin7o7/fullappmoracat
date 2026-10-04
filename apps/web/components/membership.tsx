"use client";

/**
 * Care-plan surface. Lexicon (R087): every cat with a Cat ID is already a
 * member — free, for good — so nothing here "activates" or "completes" a
 * membership. The paid product is «خطة العناية». Two honest states:
 *
 *  • No plan  → what a care plan would add, and one clear CTA. Commerce-aware —
 *    never a dead "Subscribe" link before launch (R006/R040): pre-launch it
 *    reads as "care plans open later".
 *  • On a plan → the plan's status card: plan, renewal, next box, manage.
 *    No prompts once they've joined.
 *
 * The cat stays the hero (R009): copy is named after the cat, calm not pushy
 * (care, don't extract — P8), and the ask is singular (R005).
 */
import * as React from "react";
import Link from "next/link";
import {
  BadgeCheck, Package, Percent, ArrowRight,
  Sparkles, CalendarClock, Truck, Settings, Clock, PauseCircle,
} from "lucide-react";
import { Button, Badge, Card } from "@moraqat/ui";
import { PARTNERS } from "@/lib/partners";
import { localizeName } from "@/lib/translit";
import { formatDate } from "@/lib/datetime";
import { effectiveNextDelivery } from "@/lib/launch";
import { LaunchDeliveryNote } from "./launch-note";
import { IlloCan, IlloPaw } from "./illustrations";

export interface MembershipBenefit {
  icon: React.ComponentType<{ className?: string }>;
  en: string;
  ar: string;
}

/**
 * What a care plan adds — only what the plan itself does. The Cat ID is free
 * for good (FAQ + terms), so it is never listed as something a plan unlocks;
 * partner rates appear only once a partner exists (R006/R040).
 */
export const MEMBERSHIP_BENEFITS: MembershipBenefit[] = [
  { icon: Package, en: "Food and litter at your door every month", ar: "الأكل والرمل يوصلون بابك كل شهر" },
  { icon: BadgeCheck, en: "A plan shaped by your cat's age and weight", ar: "خطة مبنية من عمر قطك ووزنه" },
  { icon: PauseCircle, en: "Pause or stop in one tap", ar: "توقفها أو تلغيها بضغطة" },
  // Member-rate lexicon (R085/R087): recognition, never coupon talk.
  ...(PARTNERS.length > 0 ? [{ icon: Percent, en: "Member rates at partners", ar: "سعر الأعضاء عند الشركاء" }] : []),
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
              <BadgeCheck className="size-3.5" /> {isAr ? "خطة العناية فعّالة" : "Care plan active"}
            </Badge>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
              {isAr ? `خطة ${planName}` : `${planName} plan`}
            </h2>
            {name && (
              <p className="mt-1 text-sm text-primary-foreground/85">
                {isAr ? `عناية ${name} الشهرية` : `${name}'s monthly care`}
              </p>
            )}
          </div>
          <Sparkles className="size-6 text-primary-foreground/40" aria-hidden />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {/* "Renews" is a money promise — it may only appear when there is a
              billing rail behind it (R040). Off-commerce it is simply absent,
              never a date we can't honour. */}
          {commerce && (
            <StatTile icon={CalendarClock} label={isAr ? "التجديد" : "Renews"} value={fmt(subscription.nextBillingAt)} />
          )}
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

        {/* Manage/Upgrade both land on commerce surfaces that are closed in
            Community Mode — offering them would be a door that doesn't open
            (R005: one clear action; R112: never a dead end). */}
        {commerce && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/portal/subscriptions">
              <Button variant="secondary" size="sm"><Settings className="size-4" /> {isAr ? "إدارة خطة العناية" : "Manage care plan"}</Button>
            </Link>
            <Link href={subscribeHref}>
              <Button variant="secondary" size="sm"><ArrowRight className="size-4 rtl:rotate-180" /> {isAr ? "غيّر الخطة" : "Change plan"}</Button>
            </Link>
          </div>
        )}
      </section>
    );
  }

  // ── No plan yet: what a care plan would add ─────────────────────────────────
  const pending = membershipStatus === "PENDING";
  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-primary/[0.05] p-6 shadow-e1 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            {name
              ? isAr ? `خطة عناية لـ${name}` : `A care plan for ${name}`
              : isAr ? "خطة عناية لقطك" : "A care plan for your cat"}
          </h2>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? `هوية ${name ?? "قطك"} جاهزة ومجانية دايم. خطة العناية الشهرية شي اختياري فوقها.`
              : `${name ?? "Your cat"}'s ID is ready, and free for good. The monthly care plan is an optional extra on top.`}
          </p>
        </div>
        {pending && (
          <Badge variant="secondary" dot className="shrink-0">
            <Clock className="size-3.5" />
            {isAr ? "خطة العناية قيد التفعيل" : "Care plan starting"}
          </Badge>
        )}
      </div>

      {/* What the plan does — proof of value before the ask (R004). */}
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
            <Button size="lg"><Sparkles className="size-4" /> {isAr ? "شوف خطة العناية" : "See the care plan"} <ArrowRight className="size-4 rtl:rotate-180" /></Button>
          </Link>
        ) : (
          <>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Sparkles className="size-4" /> {isAr ? "خطط العناية تفتح لاحقاً — وهوية قطك مجانية دايم" : "Care plans open later — your cat's ID stays free for good"}
            </span>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * The honest stand-in for a commerce surface that is closed in Community Mode
 * (/portal/subscriptions, /portal/orders). Those pages stay URL-reachable even
 * though nav hides them, and a member who lands there deserves a welcome, not
 * an error and not a blank grid (R111/R112). There are no subscribers and no
 * orders while commerce is off, so "not open yet" is the whole truth (R040).
 * The pages themselves are untouched underneath — the switch restores them.
 */
export function MembershipsClosedNotice({ isAr, body }: { isAr: boolean; body: string }) {
  return (
    <Card className="relative flex flex-col items-center gap-4 overflow-hidden p-10 text-center">
      <IlloPaw tone="butter" className="pointer-events-none absolute start-8 top-6 size-8 rotate-[-14deg] opacity-60" />
      <IlloPaw tone="peach" className="pointer-events-none absolute bottom-6 end-10 size-7 rotate-[18deg] opacity-60" />
      <IlloCan tone="green" className="h-24 w-auto" />
      <p className="font-display text-lg font-bold tracking-tight">
        {isAr ? "خطط العناية ما فتحت بعد" : "Care plans aren't open yet"}
      </p>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Link href="/portal">
        <Button size="sm">{isAr ? "إلى لوحتي" : "Go to my dashboard"}</Button>
      </Link>
    </Card>
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
