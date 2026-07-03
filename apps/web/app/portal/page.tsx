"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Package, Cat as CatIcon, Wallet, PiggyBank, Truck, ArrowRight, CreditCard, Star, IdCard, HeartPulse, Plus } from "lucide-react";
import { Card, Badge, Button, Skeleton, AnimatedCounter, Avatar, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { buildGreeting, type Gender } from "@/lib/greeting";
import { CatIdCard } from "@/components/cat-id-card";
import { OrderStatusBadge } from "@/components/order-status-badge";

interface Overview {
  owner: { firstName: string | null; gender: Gender };
  primaryCat: { id: string; name: string; catIdNumber: string | null; photoUrl: string | null } | null;
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
  };
  recentOrders: { orderNumber: string; status: string; grandTotal: number; placedAt: string }[];
}

export default function OverviewPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { primaryCat, activeCat, activeCats, setPrimaryCat, setActiveCat } = useCats();

  const { data, isLoading } = useQuery({
    queryKey: ["overview", user?.id],
    queryFn: () => authedFetch<Overview>("/account/overview"),
    enabled: !!user,
  });

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(isAr ? "ar-SA" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

  // The warm Saudi greeting — resolved from owner gender + the primary cat (R001).
  const greeting = buildGreeting({
    locale: isAr ? "ar" : "en",
    gender: data?.owner.gender ?? user?.gender,
    primaryCatName: primaryCat?.name ?? data?.primaryCat?.name,
    firstName: data?.owner.firstName ?? user?.firstName,
  });

  // Value stays visible (R041/R048); no points-scheme framing (Dossier §04).
  const stats = [
    { icon: PiggyBank, label: isAr ? "إجمالي التوفير" : "Total saved", num: data?.stats.totalSaved ?? 0, suffix: " SAR", highlight: true },
    { icon: Package, label: isAr ? "الطلبات" : "Orders", num: data?.stats.orders ?? 0 },
    { icon: CatIcon, label: isAr ? "القطط" : "Cats", num: data?.stats.catCounts.active ?? 0 },
    { icon: Wallet, label: isAr ? "المحفظة" : "Wallet", num: data?.stats.walletBalance ?? 0, suffix: " SAR" },
  ];

  // The featured cat = the one currently in focus (defaults to primary).
  const featured = activeCat ?? primaryCat;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{greeting.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {featured
            ? isAr
              ? `عضوية ${featured.name} بين يديك`
              : `${featured.name}'s membership, at a glance`
            : isAr ? "إليك ملخص حسابك" : "Here's your account at a glance"}
        </p>
      </div>

      {/* Featured Cat ID + household rail — the multi-cat hero (P09). */}
      {activeCats.length > 0 && featured ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <div className="space-y-3">
            <CatIdCard
              catName={featured.name}
              catIdNumber={featured.catIdNumber ?? "MRC-••••-••••"}
              issuedAt={featured.idIssuedAt}
              photoUrl={featured.photoUrl}
              isAr={isAr}
            />
            <div className="grid grid-cols-2 gap-2">
              <Link href="/portal/cats"><Button variant="outline" size="sm" className="w-full"><IdCard className="size-4" /> {isAr ? "الهوية" : "Cat ID"}</Button></Link>
              <Link href="/portal/cats"><Button variant="outline" size="sm" className="w-full"><HeartPulse className="size-4" /> {isAr ? "السجل الصحي" : "Health"}</Button></Link>
            </div>
          </div>

          <CatRail
            isAr={isAr}
            cats={activeCats}
            activeId={featured.id}
            onPick={setActiveCat}
            onPrimary={(id) => void setPrimaryCat(id)}
          />
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-muted"><CatIcon className="size-7 text-muted-foreground" /></span>
          <p className="text-sm text-muted-foreground">
            {isAr ? "أضف قطك الأول واحصل على هويته الرسمية فوراً" : "Add your first cat and get their official Cat ID, instantly"}
          </p>
          <Link href="/portal/cats"><Button size="sm"><Plus className="size-4" /> {isAr ? "أضف قط" : "Add a cat"}</Button></Link>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <span className={`mb-3 grid size-10 place-items-center rounded-xl ${s.highlight ? "bg-accent/15 text-accent-foreground" : "bg-primary/10 text-primary"}`}>
              <s.icon className="size-5" />
            </span>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="font-display text-2xl font-bold tabular">
                <AnimatedCounter value={s.num} suffix={s.suffix ?? ""} />
              </p>
            )}
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Active subscription */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{isAr ? "اشتراكك النشط" : "Active subscription"}</h2>
          <Link href="/portal/subscriptions"><Button variant="ghost" size="sm">{isAr ? "إدارة" : "Manage"} <ArrowRight className="size-4" /></Button></Link>
        </div>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : data?.activeSubscription ? (
          <div className="flex flex-wrap items-center gap-6 rounded-xl bg-muted/50 p-4">
            <Badge>{data.activeSubscription.plan ? (isAr ? data.activeSubscription.plan.nameAr : data.activeSubscription.plan.nameEn) : (isAr ? "مخصص" : "Custom")}</Badge>
            <InfoBit icon={CreditCard} label={isAr ? "السعر" : "Price"} value={`${data.activeSubscription.price} SAR`} />
            <InfoBit icon={Truck} label={isAr ? "التوصيل القادم" : "Next delivery"} value={fmtDate(data.activeSubscription.nextDeliveryAt)} />
            <InfoBit icon={CreditCard} label={isAr ? "الفوترة القادمة" : "Next billing"} value={fmtDate(data.activeSubscription.nextBillingAt)} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">{isAr ? "لا يوجد اشتراك نشط بعد" : "No active subscription yet"}</p>
            <Link href="/#plans"><Button size="sm">{isAr ? "ابدأ اشتراكاً" : "Start a subscription"}</Button></Link>
          </div>
        )}
      </Card>

      {/* Recent orders */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{isAr ? "أحدث الطلبات" : "Recent orders"}</h2>
          <Link href="/portal/orders"><Button variant="ghost" size="sm">{isAr ? "الكل" : "View all"} <ArrowRight className="size-4" /></Button></Link>
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
        <Link href="/portal/cats"><Button variant="ghost" size="sm">{isAr ? "الكل" : "View all"} <ArrowRight className="size-4" /></Button></Link>
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
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    {c.isPrimary && <Star className="size-3 shrink-0 fill-accent text-accent" />}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground" dir="ltr">{c.catIdNumber}</span>
                </span>
              </button>
              {!c.isPrimary && (
                <button
                  type="button"
                  title={isAr ? "اجعله الأساسي" : "Make primary"}
                  aria-label={isAr ? "اجعله الأساسي" : "Make primary"}
                  onClick={() => onPrimary(c.id)}
                  className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-accent/15 hover:text-accent-foreground focus:opacity-100 group-hover:opacity-100"
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

function InfoBit({ icon: Icon, label, value }: { icon: typeof Truck; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
