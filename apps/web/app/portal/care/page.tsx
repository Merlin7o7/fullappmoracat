"use client";

import * as React from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { ShieldCheck, Repeat, Package, ArrowLeft, Syringe } from "lucide-react";
import { Card, EmptyState, Skeleton, StatusTag } from "@moraqat/ui";
import { formatDate, formatRelative } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { commerceEnabled } from "@/lib/features";
import { localizeName } from "@/lib/translit";
import type { HealthRecord } from "@/components/cat-health-record";
import { Illo3D } from "@/components/illo-3d";
import { HubLink } from "@/components/hub-link";

type Item = { key: string; catId: string; catName: string; label: string; dueAt: string; state: "overdue" | "due" | "upcoming" };

/**
 * «العناية» — what needs doing, for every cat, in one list.
 *
 * The question a member opens this to answer is "is anything due?" — so the
 * page leads with the answer (overdue first, then the next 30 days), and keeps
 * the rest (clinic access, the membership box) as quiet doors underneath.
 */
export default function CarePage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const loc = isAr ? "ar" : "en";
  const { activeCats, isLoading: catsLoading } = useCats();

  const results = useQueries({
    queries: activeCats.map((c) => ({
      queryKey: ["cat-health", c.id],
      queryFn: () => authedFetch<HealthRecord>(`/cats/${c.id}/health`),
      enabled: !!user,
    })),
  });
  const loading = catsLoading || results.some((r) => r.isLoading);

  const now = Date.now();
  const items: Item[] = [];
  results.forEach((r, i) => {
    const cat = activeCats[i];
    if (!r.data || !cat) return;
    const latest = new Map<string, HealthRecord["vaccination"]["records"][number]>();
    for (const v of r.data.vaccination.records) {
      const prev = latest.get(v.name);
      if (!prev || +new Date(v.administeredAt) > +new Date(prev.administeredAt)) latest.set(v.name, v);
    }
    for (const v of latest.values()) {
      if (!v.dueAt) continue;
      const due = +new Date(v.dueAt);
      const state: Item["state"] = due < now ? "overdue" : due - now < 30 * 86_400_000 ? "due" : "upcoming";
      items.push({ key: v.id, catId: cat.id, catName: localizeName(cat.name, loc), label: v.name, dueAt: v.dueAt, state });
    }
  });
  items.sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
  const now30 = items.filter((i) => i.state !== "upcoming");
  const later = items.filter((i) => i.state === "upcoming").slice(0, 6);
  const commerce = commerceEnabled();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-4xl">{isAr ? "العناية" : "Care"}</h1>
        <p className="text-muted-foreground">
          {isAr ? "ما يحتاجه كل قط في البيت — المتأخر أولاً." : "What every cat in the home needs — overdue first."}
        </p>
      </header>

      <section aria-labelledby="now" className="space-y-3">
        <h2 id="now" className="font-display text-2xl">{isAr ? "الآن والأسابيع القادمة" : "Now and the coming weeks"}</h2>
        {loading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : activeCats.length === 0 ? (
          <Card>
            <EmptyState
              art={<Illo3D name="heart" className="size-28" px={112} />}
              title={isAr ? "أضف قطك لتبدأ عنايته" : "Add your cat to start their care"}
              action={
                <Link href="/portal/cats/new" className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground">
                  {isAr ? "أضف قطك" : "Add your cat"}
                </Link>
              }
            />
          </Card>
        ) : now30.length === 0 ? (
          <Card>
            <EmptyState
              art={<Illo3D name="heart" className="size-28" px={112} />}
              title={isAr ? "ما فيه شيء مستحق" : "Nothing is due"}
              body={
                items.length
                  ? isAr ? "كل التطعيمات المسجّلة في وقتها. نذكّرك قبل الموعد القادم." : "Every recorded vaccine is on time. We'll remind you before the next one."
                  : isAr ? "سجّل آخر تطعيم من دفتر قطك، ونتابع المواعيد عنك." : "Record the last vaccine from your cat's booklet and we'll keep track of the dates."
              }
            />
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {now30.map((i) => (
              <CareRow key={i.key} item={i} isAr={isAr} />
            ))}
          </Card>
        )}
        {later.length > 0 && (
          <details className="group rounded-2xl border border-border bg-card">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 text-sm font-medium">
              {isAr ? `لاحقاً (${later.length})` : `Later (${later.length})`}
              <ArrowLeft className="size-4 -rotate-90 transition-transform group-open:rotate-90" aria-hidden />
            </summary>
            <div className="divide-y divide-border border-t border-border">
              {later.map((i) => (
                <CareRow key={i.key} item={i} isAr={isAr} />
              ))}
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="more" className="space-y-3">
        <h2 id="more" className="font-display text-2xl">{isAr ? "إدارة العناية" : "Managing care"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <HubLink
            href="/portal/health-access"
            icon={ShieldCheck}
            title={isAr ? "وصول العيادات" : "Clinic access"}
            body={isAr ? "من يقدر يفتح سجل قطك — ومن فتحه فعلاً" : "Who may open your cat's record — and who has"}
          />
          {commerce && (
            <>
              <HubLink href="/portal/subscriptions" icon={Repeat} title={isAr ? "العضوية" : "Membership"} body={isAr ? "خطتك وصناديقك القادمة" : "Your plan and coming boxes"} />
              <HubLink href="/portal/orders" icon={Package} title={isAr ? "الصناديق والطلبات" : "Boxes & orders"} body={isAr ? "ما وصلك وما في الطريق" : "What arrived and what's on the way"} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function CareRow({ item, isAr }: { item: Item; isAr: boolean }) {
  const loc = isAr ? "ar" : "en";
  return (
    <Link href={`/portal/cats/${item.catId}/health`} className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/50">
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <Syringe className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{item.label}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {item.catName} · {formatDate(item.dueAt, loc, "medium")}
          </span>
        </span>
      </span>
      <StatusTag tone={item.state === "overdue" ? "critical" : item.state === "due" ? "attention" : "neutral"}>
        {item.state === "overdue" ? (isAr ? "متأخر" : "Overdue") : formatRelative(item.dueAt, loc)}
      </StatusTag>
    </Link>
  );
}
