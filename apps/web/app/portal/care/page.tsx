"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Repeat, Package, ChevronDown } from "lucide-react";
import { Card, EmptyState, Skeleton } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { commerceEnabled } from "@/lib/features";
import { QueryError } from "@/components/query-error";
import { Illo3D } from "@/components/illo-3d";
import { HubLink } from "@/components/hub-link";
import { CareList, type CareTaskView } from "@/components/care/care-list";

/**
 * «العناية» — what needs doing, for every cat, in one list (the care engine).
 *
 * The question a member opens this to answer is "is anything due?" — so the
 * page leads with the answer: overdue and this week first, then what's next,
 * and keeps the rest (clinic access, the membership box) as quiet doors below.
 */
export default function CarePage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { activeCats, isLoading: catsLoading } = useCats();
  const q = useQuery({
    queryKey: ["care-agenda"],
    queryFn: () => authedFetch<{ protocolApproved: boolean; tasks: CareTaskView[] }>("/care"),
    enabled: !!user,
  });

  const tasks = q.data?.tasks ?? [];
  const now = tasks.filter((t) => t.state === "overdue" || t.state === "due");
  const later = tasks.filter((t) => t.state === "upcoming");
  const commerce = commerceEnabled();
  const multi = activeCats.length > 1;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-4xl">{isAr ? "العناية" : "Care"}</h1>
        <p className="text-muted-foreground">
          {isAr ? "ما يحتاجه كل قط في البيت — المتأخر أولاً." : "What every cat in the home needs — overdue first."}
        </p>
      </header>

      <section aria-labelledby="now" className="space-y-3">
        <h2 id="now" className="font-display text-2xl">{isAr ? "هذا الأسبوع" : "This week"}</h2>
        {catsLoading || q.isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : q.isError ? (
          <QueryError isAr={isAr} onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : activeCats.length === 0 ? (
          <Card>
            <EmptyState
              art={<Illo3D name="bowl" className="size-28" px={112} />}
              title={isAr ? "أضف قطك لتبدأ عنايته" : "Add your cat to start their care"}
              action={
                <Link href="/portal/cats/new" className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground">
                  {isAr ? "أضف قطك" : "Add your cat"}
                </Link>
              }
            />
          </Card>
        ) : now.length === 0 ? (
          <Card>
            <EmptyState
              art={<Illo3D name="bowl" className="size-28" px={112} />}
              title={isAr ? "ما فيه شيء مستحق هالأسبوع" : "Nothing is due this week"}
              body={isAr ? "نذكّرك قبل أي موعد قادم." : "We'll remind you before anything that's coming up."}
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CareList tasks={now} isAr={isAr} showCat={multi} invalidate={[["care-agenda"]]} />
          </Card>
        )}

        {later.length > 0 && (
          <details className="group overflow-hidden rounded-2xl border border-border bg-card">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 text-sm font-medium">
              {isAr ? `لاحقاً (${later.length})` : `Later (${later.length})`}
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="border-t border-border">
              <CareList tasks={later} isAr={isAr} showCat={multi} invalidate={[["care-agenda"]]} />
            </div>
          </details>
        )}
        {q.data && !q.data.protocolApproved && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {isAr
              ? "مواعيد التطعيم هنا من سجل قطك فقط — ما نقترح جدولاً طبياً قبل أن يعتمده طبيب بيطري."
              : "Vaccine dates here come only from your cat's record — we don't suggest a medical schedule until a veterinarian has signed it off."}
          </p>
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
