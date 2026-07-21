"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Package, Cat as CatIcon, Wallet, PiggyBank, ArrowRight, Star, IdCard, HeartPulse, Plus, Users, Sparkles, Gift, Copy, Check, CalendarClock } from "lucide-react";
import { Card, Button, Skeleton, AnimatedCounter, Avatar, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { commerceEnabled } from "@/lib/features";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { buildGreeting, type Gender } from "@/lib/greeting";
import { localizeName } from "@/lib/translit";
import { formatDate } from "@/lib/datetime";
import { track } from "@/lib/analytics";
import { CatIdCard } from "@/components/cat-id-card";
import { MembershipCard } from "@/components/membership";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { QueryError } from "@/components/query-error";
import { IlloCat, IlloFish, IlloPaw } from "@/components/illustrations";

/** Quiet paw watermark for the value strip. */
function IlloPawSticker() {
  return (
    <IlloPaw
      tone="peach"
      className="pointer-events-none absolute -top-5 end-16 size-16 rotate-[16deg] opacity-[0.13]"
    />
  );
}

interface Completion { percent: number; done: number; total: number; missing: string[] }
interface Overview {
  owner: { firstName: string | null; gender: Gender; memberSince: string | null };
  primaryCat: { id: string; name: string; catIdNumber: string | null; photoUrl: string | null; completion: Completion | null } | null;
  activeSubscription: null | {
    id: string;
    plan: { nameEn: string; nameAr: string; tier: string } | null;
    price: number;
    nextDeliveryAt: string | null;
    nextBillingAt: string | null;
  };
  stats: {
    orders: number;
    cats: number;
    catCounts: { total: number; active: number; archived: number; deceased: number };
    walletBalance: number;
    totalSaved: number;
    loyaltyPoints: number;
    loyaltyTier: string;
    unreadNotifications: number;
    /** The beta value ledger (R041/R048/R049) — care accrued, not money. */
    healthRecords: number;
    photos: number;
    communityLikes: number;
  };
  recentOrders: { orderNumber: string; status: string; grandTotal: number; placedAt: string }[];
  comingUp?: {
    type: "vaccination" | "delivery";
    at: string | null;
    catId: string | null;
    catName: string | null;
    label: string | null;
  }[];
}

export default function OverviewPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const {
    primaryCat, activeCat, activeCats, setPrimaryCat, setActiveCat,
    isLoading: catsLoading, isError: catsError, isFetching: catsFetching, refetch: refetchCats,
  } = useCats();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["overview", user?.id],
    queryFn: () => authedFetch<Overview>("/account/overview"),
    enabled: !!user,
  });

  const fmtDate = (d: string | null) =>
    d ? formatDate(d, isAr ? "ar" : "en", { day: "numeric", month: "short", year: "numeric" }) : "—";

  // The warm Saudi greeting — resolved from owner gender + the primary cat (R001).
  const greeting = buildGreeting({
    locale: isAr ? "ar" : "en",
    gender: data?.owner.gender ?? user?.gender,
    primaryCatName: primaryCat?.name ?? data?.primaryCat?.name,
    firstName: data?.owner.firstName ?? user?.firstName,
  });

  // Community Mode: no commercial surfaces on the home screen — belonging leads,
  // and we never show a "Saved 0 SAR" zero where value should be (R048/R041).
  const commerce = commerceEnabled();
  const numLocale = isAr ? "ar" : "en";

  // Value stays visible (R041/R048); no points-scheme framing (Dossier §04).
  const proofs = commerce
    ? [
        { icon: Package, label: isAr ? "الطلبات" : "Orders", num: data?.stats.orders ?? 0 },
        { icon: CatIcon, label: isAr ? "القطط" : "Cats", num: data?.stats.catCounts.active ?? 0 },
        { icon: Wallet, label: isAr ? "المحفظة" : "Wallet", num: data?.stats.walletBalance ?? 0, suffix: " SAR" },
      ]
    : [
        // Non-monetary value that actually accrues in a payments-off beta (R049).
        { icon: CatIcon, label: isAr ? "قطط نشطة" : "Active cats", num: data?.stats.catCounts.active ?? 0 },
        { icon: IdCard, label: isAr ? "هويات صادرة" : "Cat IDs issued", num: data?.stats.catCounts.total ?? 0 },
      ];

  // The featured cat = the one currently in focus (defaults to primary).
  const featured = activeCat ?? primaryCat;

  // The beta value ledger (R048/R041/R049) — the home screen proves what the
  // membership already holds, it never advertises what's coming. Every counter
  // is real, and a zero is omitted rather than shown as an empty brag (R115).
  const memberDays = data?.owner.memberSince
    ? Math.floor((Date.now() - new Date(data.owner.memberSince).getTime()) / 86_400_000)
    : 0;
  // "New" = first two weeks (or tenure unknown): the only window where an
  // intro link belongs on the value dashboard (R048).
  const isNewMember = !data?.owner.memberSince || memberDays < 14;
  const ledger = [
    { num: data?.stats.healthRecords ?? 0, label: isAr ? "سجل صحي محفوظ" : "health records kept" },
    { num: data?.stats.photos ?? 0, label: isAr ? "صورة بأمان" : "photos kept safe" },
    { num: memberDays, label: isAr ? "يوم في العضوية" : "days a member" },
    { num: data?.stats.communityLikes ?? 0, label: isAr ? "قلب من المجتمع" : "hearts from the community" },
  ].filter((s) => s.num > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{greeting.title}</h1>
        {user?.memberIdNumber && (
          <p className="mt-1 font-mono text-xs tracking-wider text-muted-foreground/70" dir="ltr">
            {isAr ? "عضو مرقط" : "Moracat member"} · {user.memberIdNumber}
            {data?.owner.memberSince && (
              <span className="text-muted-foreground/60"> · {isAr ? "عضو منذ" : "since"} {fmtDate(data.owner.memberSince)}</span>
            )}
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {featured
            ? isAr
              ? `عضوية ${localizeName(featured.name, "ar")} بين يديك`
              : `${localizeName(featured.name, "en")}'s membership, at a glance`
            : isAr ? "إليك ملخص حسابك" : "Here's your account at a glance"}
        </p>
        {/* An intro link is for members who are new — after two weeks the home
            screen is a value dashboard, not a billboard (R048). */}
        {isNewMember && (
          <Link
            href="/about"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <Sparkles className="size-4" /> {isAr ? "تعرّف على مرقط" : "Learn about Moracat"}
          </Link>
        )}
      </div>

      {/* Membership — the bridge from the Cat ID (acquisition) to the subscription
          (the product). Prominent + persistent for non-subscribers; the status
          card for subscribers; honest about commerce mode (R004/R005/R040). */}
      {!isLoading && !catsLoading && !catsError && activeCats.length > 0 && featured && (
        <MembershipCard
          isAr={isAr}
          commerce={commerce}
          subscription={data?.activeSubscription ?? null}
          catName={featured.name}
          membershipStatus={featured.membershipStatus}
          subscribeHref={`/portal/subscribe?cat=${featured.id}`}
        />
      )}

      {/* Featured Cat ID + household rail — the multi-cat hero (P09).
          A failed roster load must never masquerade as "no cats" (R112): show a
          blameless retry, not the empty welcome. Only a real empty roster is a
          welcome (R111). */}
      {catsLoading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
          {/* Match the real Cat ID column (max-w-sm inside minmax(0,20rem)) so the
              loaded card lands exactly where the skeleton was — no layout shift. */}
          <Skeleton className="h-56 w-[min(24rem,100%)] rounded-2xl lg:w-full" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : catsError ? (
        <QueryError isAr={isAr} onRetry={() => refetchCats()} retrying={catsFetching} />
      ) : activeCats.length > 0 && featured ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <div className="space-y-3">
            <CatIdCard
              catName={featured.name}
              catIdNumber={featured.catIdNumber ?? "MRC-••••-••••"}
              catNumber={featured.catNumber}
              foundingClass={isAr ? featured.foundingClass?.ar : featured.foundingClass?.en}
              issuedAt={featured.idIssuedAt}
              photoUrl={featured.photoUrl}
              isAr={isAr}
              membershipActive={featured.membershipStatus === "ACTIVE"}
              qrToken={featured.qrToken}
            />
            <div className="grid grid-cols-2 gap-2">
              {/* Two actions, two destinations — each carries the featured cat so
                  the next screen opens on THEIR card/record, not a generic list (R005). */}
              <Link href={`/portal/cats?cat=${featured.id}`}><Button variant="outline" size="sm" className="w-full"><IdCard className="size-4" /> {isAr ? "الهوية" : "Cat ID"}</Button></Link>
              <Link href={`/portal/cats?cat=${featured.id}&panel=health`}><Button variant="outline" size="sm" className="w-full"><HeartPulse className="size-4" /> {isAr ? "السجل الصحي" : "Health"}</Button></Link>
            </div>
          </div>

          <CatRail
            isAr={isAr}
            cats={activeCats}
            activeId={featured.id}
            onPick={setActiveCat}
            onPrimary={(id) => { void setPrimaryCat(id).catch(() => {}); }}
          />
        </div>
      ) : (
        /* Empty state = a welcome, not a void (R111). */
        <Card className="relative flex flex-col items-center gap-4 overflow-hidden p-10 text-center">
          <IlloPaw tone="butter" className="pointer-events-none absolute start-8 top-6 size-8 rotate-[-14deg] opacity-60" />
          <IlloPaw tone="peach" className="pointer-events-none absolute bottom-6 end-10 size-7 rotate-[18deg] opacity-60" />
          <IlloCat tone="green" className="h-24 w-auto" />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {isAr ? "أضف قطك الأول واحصل على هويته الرسمية فوراً" : "Add your first cat and get their official Cat ID, instantly"}
          </p>
          {/* Straight to the add-cat flow — never a hop through another list page (R002). */}
          <Link href="/portal/cats/new"><Button size="sm"><Plus className="size-4" /> {isAr ? "أضف قط" : "Add a cat"}</Button></Link>
        </Card>
      )}

      {/* "Coming up" — the forward glance of a care dashboard (R049/P8): the next
          vaccination or delivery, computed server-side; the lifecycle engine
          sends the matching reminder. Max two quiet rows, hidden when empty. */}
      {!!data?.comingUp?.length && (
        <Card className="p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <CalendarClock className="size-4 text-primary" />
            {isAr ? "قادم قريباً" : "Coming up"}
          </p>
          <ul className="space-y-1.5">
            {data.comingUp.map((e, i) => (
              <li key={i}>
                {e.type === "vaccination" ? (
                  <Link
                    href={`/portal/cats?cat=${e.catId}&panel=health`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    <span>
                      {isAr
                        ? `تطعيم «${e.label}» لـ${e.catName}`
                        : `${e.catName}'s ${e.label} vaccination`}
                      <span className="text-muted-foreground"> — {isAr ? "سنذكّرك قبله" : "we'll remind you"}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(e.at)}</span>
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm">
                    <span>{isAr ? "صندوقك القادم في الطريق" : "Your next box"}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(e.at)}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* On a failed load we never fabricate value (R112): a zeroed "Saved 0 SAR"
          would be a trust breach. Show the blameless retry instead of the tiles. */}
      {isError ? (
        <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
      ) : (
        <>
      {/* Value strip. In Community Mode belonging leads — a "Saved 0 SAR" number
          would put a zero where value should be (R048). The savings hero returns
          the moment memberships (and real savings) go live. */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {commerce ? (
          <div className="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-e2 ring-hairline sm:p-7">
            <IlloFish
              tone="orange"
              className="pointer-events-none absolute -end-4 bottom-4 h-14 w-auto rotate-[-8deg] opacity-90"
            />
            <IlloPawSticker />
            <p className="flex items-center gap-2 text-sm font-medium text-primary-foreground/85">
              <PiggyBank className="size-4" />
              {isAr ? "وفّرت معنا حتى اليوم" : "Saved with us so far"}
            </p>
            {isLoading ? (
              <Skeleton className="mt-3 h-12 w-40 bg-primary-foreground/10" />
            ) : (
              <p className="mt-2 font-display text-5xl font-semibold tabular tracking-tight sm:text-6xl">
                <AnimatedCounter value={data?.stats.totalSaved ?? 0} locale={numLocale} />
                <span className="ms-2 text-lg font-medium text-primary-foreground/85">SAR</span>
              </p>
            )}
            <p className="mt-2 text-xs text-primary-foreground/85">
              {isAr ? "سعر العضو مثبّت لك عند كل طلب — هذا الدليل" : "Your member rate, honoured on every order — this is the proof"}
            </p>
            {/* TODO(R043): value-received vs fee-paid once order history totals are exposed on overview */}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-e2 ring-hairline sm:p-7">
            <IlloPawSticker />
            <p className="flex items-center gap-2 text-sm font-medium text-primary-foreground/85">
              <Sparkles className="size-4" />
              {isAr ? "أنت عضو في مرقط" : "You're a Moracat member"}
            </p>
            <p className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {featured
                ? isAr
                  ? `${localizeName(featured.name, "ar")} صار له هوية`
                  : `${localizeName(featured.name, "en")} has an identity`
                : isAr ? "قطك يستاهل هوية" : "Your cat deserves an identity"}
            </p>
            {/* The value ledger — proof of what the membership already holds
                (R041/R048/R049). Zeros are omitted, never bragged (R115); a
                brand-new member gets the warm welcome line instead (R111). */}
            {isLoading ? (
              <Skeleton className="mt-4 h-10 w-56 bg-primary-foreground/10" />
            ) : ledger.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-x-7 gap-y-3">
                {ledger.map((s) => (
                  <div key={s.label} className="min-w-0">
                    <p className="font-display text-2xl font-semibold tabular leading-tight">
                      <AnimatedCounter value={s.num} locale={numLocale} />
                    </p>
                    <p className="mt-0.5 text-[11px] text-primary-foreground/75">{s.label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 max-w-md text-xs leading-relaxed text-primary-foreground/85">
                {isAr
                  ? "الانتماء والهوية والسجل الصحي — لك من أول يوم."
                  : "Belonging, an identity and a health record — yours from day one."}
              </p>
            )}
            {data?.primaryCat?.completion && data.primaryCat.completion.percent < 100 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-primary-foreground/85">
                  <span>{isAr ? `ملف ${localizeName(data.primaryCat.name, "ar")} مكتمل` : `${localizeName(data.primaryCat.name, "en")}'s file`}</span>
                  <span className="tabular">{data.primaryCat.completion.percent}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary-foreground/20">
                  <div className="h-full rounded-full bg-primary-foreground/90 transition-[width] duration-700" style={{ width: `${data.primaryCat.completion.percent}%` }} />
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/portal/community"><Button variant="glass" size="sm"><Users className="size-4" /> {isAr ? "استكشف المجتمع" : "Explore community"}</Button></Link>
              <Link href="/portal/cats"><Button variant="glass" size="sm"><IdCard className="size-4" /> {isAr ? "أكمل ملف قطك" : "Complete your cat's file"}</Button></Link>
            </div>
            {/* One quiet forward-looking line — a footnote, never the headline (R048). */}
            <p className="mt-4 text-[11px] text-primary-foreground/60">
              {isAr
                ? "أسعار الأعضاء والتوصيل يجون لما تنزل العضويات."
                : "Member rates and delivery arrive when memberships launch."}
            </p>
          </div>
        )}

        <div className={cn("grid gap-4 lg:grid-cols-1 lg:content-between", proofs.length >= 3 ? "grid-cols-3" : "grid-cols-2")}>
          {proofs.map((s) => (
            <Card key={s.label} className="flex items-center gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="size-5" />
              </span>
              <div className="min-w-0">
                {isLoading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <p className="truncate font-display text-xl font-bold tabular leading-tight">
                    <AnimatedCounter value={s.num} suffix={s.suffix ?? ""} locale={numLocale} />
                  </p>
                )}
                <p className="truncate text-xs text-muted-foreground">{s.label}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Commercial surfaces (subscription + orders) only when payments are live —
          in beta they'd be permanently empty, so we don't show hollow cards. */}
      {commerce ? (
        <>
          {/* Active-subscription status now lives in the MembershipCard at the top
              of the dashboard — this section keeps the order history. */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{isAr ? "أحدث الطلبات" : "Recent orders"}</h2>
              <Link href="/portal/orders"><Button variant="ghost" size="sm">{isAr ? "الكل" : "View all"} <ArrowRight className="size-4 rtl:rotate-180" /></Button></Link>
            </div>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : data && data.recentOrders.length > 0 ? (
              <div className="divide-y divide-border">
                {data.recentOrders.map((o) => (
                  <div key={o.orderNumber} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{o.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(o.placedAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderStatusBadge status={o.status} isAr={isAr} />
                      <span className="font-display font-semibold">{o.grandTotal} SAR</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">{isAr ? "لا توجد طلبات بعد" : "No orders yet"}</p>
            )}
          </Card>
        </>
      ) : (
        /* Beta: belonging + referral where the commercial cards would be. */
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <IlloPaw tone="peach" className="size-8 rotate-[10deg]" />
            <p className="max-w-sm text-sm text-muted-foreground">
              {isAr
                ? "شارك قطك في المجتمع، شوف قطط الأعضاء الآخرين، واجمع الإعجابات — كل هذا مجاناً في مرقط."
                : "Share your cat, meet other members' cats, and collect love — all free on Moracat."}
            </p>
            <Link href="/portal/community"><Button size="sm"><Users className="size-4" /> {isAr ? "افتح المجتمع" : "Open the community"}</Button></Link>
          </Card>
          <ReferralCard isAr={isAr} />
        </div>
      )}
        </>
      )}
    </div>
  );
}

/**
 * The household rail — stays clean and scannable at any size (Dashboard req):
 * 1 cat → a single "meet the household" prompt; a few → comfortable cards;
 * many (10+) → a capped, dense grid with a clear "+N more" into the full roster.
 */
function CatRail({
  isAr, cats, activeId, onPick, onPrimary,
}: {
  isAr: boolean;
  cats: { id: string; name: string; catIdNumber: string | null; photoUrl: string | null; isPrimary: boolean }[];
  activeId: string;
  onPick: (id: string) => void;
  onPrimary: (id: string) => void;
}) {
  const CAP = 9; // keep the grid tidy; the rest live one tap away
  const visible = cats.slice(0, CAP);
  const overflow = cats.length - visible.length;

  return (
    <Card className="flex flex-col p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">
          {isAr ? "قطط البيت" : "Your household"}
          <span className="ms-2 text-sm font-normal text-muted-foreground">{cats.length}</span>
        </h2>
        <Link href="/portal/cats"><Button variant="ghost" size="sm">{isAr ? "الكل" : "View all"} <ArrowRight className="size-4 rtl:rotate-180" /></Button></Link>
      </div>

      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 sm:grid-cols-3">
        {visible.map((c) => {
          const active = c.id === activeId;
          return (
            <div
              key={c.id}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-xl border p-2.5 transition-colors",
                active ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
              )}
            >
              <button type="button" onClick={() => onPick(c.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
                <Avatar size="sm" name={c.name} src={c.photoUrl} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-sm font-medium">{localizeName(c.name, isAr ? "ar" : "en")}</span>
                    {c.isPrimary && <Star className="size-3 shrink-0 fill-accent text-accent" />}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground" dir="ltr">{c.catIdNumber}</span>
                </span>
              </button>
              {/* Visible at rest on touch (no hover exists there, R098); the
                  hover-reveal remains a desktop-only refinement. */}
              {!c.isPrimary && (
                <button
                  type="button"
                  title={isAr ? "اجعله الأساسي" : "Make primary"}
                  aria-label={isAr ? "اجعله الأساسي" : "Make primary"}
                  onClick={() => onPrimary(c.id)}
                  className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-md text-muted-foreground opacity-60 transition hover:bg-accent/15 hover:text-accent-foreground focus:opacity-100 group-hover:opacity-100 sm:opacity-0"
                >
                  <Star className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}

        <Link
          href="/portal/cats"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          {overflow > 0 ? (
            <span>+{overflow} {isAr ? "غيرها" : "more"}</span>
          ) : (
            <><Plus className="size-4" /> {isAr ? "أضف" : "Add"}</>
          )}
        </Link>
      </div>
    </Card>
  );
}

/**
 * Invite-with-recognition (§9, «عزيمة»). Recognises the real cats a member has
 * brought into the census — never a buyable queue position (R006) or a points
 * game (design authority: recognition, not gamification). The number shown is
 * `brought` (friends whose cats actually registered), not raw signups.
 */
interface ReferralData {
  code: string;
  invited: number;
  brought: number;
  link: string;
  milestones: number[];
  recognition: {
    brought: number;
    isFoundingSupporter: boolean;
    nextMilestone: number | null;
    toNext: number;
    title: string;
    detail: string;
  };
}

function ReferralCard({ isAr }: { isAr: boolean }) {
  const { authedFetch, user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const { data } = useQuery({
    queryKey: ["referral", user?.id],
    queryFn: () => authedFetch<ReferralData>("/account/referral"),
    enabled: !!user,
  });

  const share = async () => {
    if (!data) return;
    const text = isAr
      ? `انضم لي في مرقط — عضوية وهوية لقطك: ${data.link}`
      : `Join me on Moracat — a membership and identity for your cat: ${data.link}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Moracat", text, url: data.link });
        track("referral_invite_sent", { channel: "native" });
        return;
      } catch { /* cancelled — fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      track("referral_link_copied", {});
      toast({ title: isAr ? "تم نسخ الرابط" : "Link copied", variant: "success" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: isAr ? "تعذّر النسخ" : "Couldn’t copy", variant: "error" });
    }
  };

  const rec = data?.recognition;
  // Progress toward the next gentle threshold — a "cats you've helped join" bar,
  // framed as impact, never a score or a leaderboard.
  const target = rec?.nextMilestone ?? (data?.milestones[data.milestones.length - 1] ?? 1);
  const pct = rec ? Math.min(100, Math.round((rec.brought / target) * 100)) : 0;

  return (
    <Card className="flex flex-col gap-3 p-6">
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-secondary/40 text-secondary-foreground"><Gift className="size-5" /></span>
        <div>
          <p className="font-display font-semibold">{rec?.title ?? (isAr ? "ادعُ صديقاً" : "Invite a friend")}</p>
          <p className="text-xs text-muted-foreground">{rec?.detail ?? (isAr ? "شارك مرقط مع محبّي القطط" : "Share Moracat with cat people")}</p>
        </div>
      </div>
      {data ? (
        <>
          {/* Recognition: real cats brought into the census + honest progress. */}
          {rec && rec.brought > 0 && (
            <div className="rounded-xl border border-border bg-cream/50 px-3 py-2.5 dark:bg-cream/10">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <Sparkles className="size-3.5 text-primary" />
                  {isAr ? `${rec.brought.toLocaleString("ar-SA")} قط انضمّ بدعوتك` : `${rec.brought} cats joined through you`}
                </span>
                {rec.nextMilestone && (
                  <span className="text-muted-foreground">
                    {isAr ? `${rec.toNext.toLocaleString("ar-SA")} حتى ${rec.nextMilestone.toLocaleString("ar-SA")}` : `${rec.toNext} to ${rec.nextMilestone}`}
                  </span>
                )}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={rec.brought} aria-valuemin={0} aria-valuemax={target}>
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl border border-dashed border-border px-3 py-2.5">
            <code className="truncate font-mono text-sm" dir="ltr">{data.code}</code>
            {data.invited > 0 && (
              <span className="ms-2 shrink-0 text-xs text-muted-foreground">
                {isAr ? `دعوت ${data.invited.toLocaleString("ar-SA")}` : `${data.invited} invited`}
              </span>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={share} className="w-fit">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {isAr ? "شارك رابط الدعوة" : "Share invite link"}
          </Button>
        </>
      ) : (
        <Skeleton className="h-20 w-full" />
      )}
    </Card>
  );
}

