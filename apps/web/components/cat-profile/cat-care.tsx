"use client";

import { useQuery } from "@tanstack/react-query";
import { Syringe } from "lucide-react";
import { Card, EmptyState, Skeleton } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { QueryError } from "@/components/query-error";
import { CareList, type CareTaskView } from "@/components/care/care-list";

export type CareResponse = { protocolApproved: boolean; tasks: CareTaskView[] };

/** One query for a cat's care, shared by the profile's "Now" ledger, the home and the health tab. */
export function useCatCare(catId: string | null | undefined) {
  const { authedFetch, user } = useAuth();
  return useQuery({
    queryKey: ["cat-care", catId],
    queryFn: () => authedFetch<CareResponse>(`/cats/${catId}/care`),
    enabled: !!user && !!catId,
  });
}

const OPEN = (t: CareTaskView) => t.state !== "done" && t.state !== "skipped";

/** The one care item that matters most right now: overdue first, then the soonest due. */
export function nextCareItem(tasks: CareTaskView[] | undefined): CareTaskView | null {
  const open = (tasks ?? []).filter(OPEN);
  if (!open.length) return null;
  const rank = (t: CareTaskView) => (t.state === "overdue" ? 0 : t.state === "due" ? 1 : 2);
  return [...open].sort((a, b) => rank(a) - rank(b) || +new Date(a.dueAt) - +new Date(b.dueAt))[0] ?? null;
}

/** The cat's care, from the engine: open items first, recently done below. Lives on the health tab. */
export function CatCare({ catId, isAr, name }: { catId: string; isAr: boolean; name: string }) {
  const q = useCatCare(catId);
  if (q.isLoading) return <Skeleton className="h-32 w-full rounded-2xl" />;
  if (q.isError) return <QueryError isAr={isAr} onRetry={() => q.refetch()} retrying={q.isFetching} />;
  const tasks = q.data?.tasks ?? [];
  const open = tasks.filter(OPEN);
  const closed = tasks.filter((t) => !OPEN(t)).slice(0, 3);
  if (!tasks.length) {
    return (
      <Card>
        <EmptyState
          art={<Syringe className="size-6 text-muted-foreground" aria-hidden />}
          title={isAr ? "ما فيه مواعيد بعد" : "No care dates yet"}
          body={isAr ? `سجّل آخر تطعيم لـ${name} من دفتره، ونذكّرك قبل الجرعة التالية.` : `Record ${name}'s last vaccine from the booklet and we'll remind you before the next dose.`}
        />
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <CareList tasks={[...open, ...closed]} isAr={isAr} invalidate={[["cat-care", catId], ["care-agenda"]]} />
    </Card>
  );
}
