"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package, CreditCard, Truck, Repeat, Megaphone, Bell,
  Heart, CheckCheck, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { Card, Button, Skeleton, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { QueryError } from "@/components/query-error";
import { IlloMouse, IlloPaw } from "@/components/illustrations";
import { notificationText, notificationHref } from "@/lib/notifications";
import { formatDateTime } from "@/lib/datetime";

interface NotificationItem {
  id: string;
  category: string;
  title: string;
  body: string;
  data: unknown;
  readAt: string | null;
  createdAt: string;
}
interface NotificationsPage {
  items: NotificationItem[];
  unread: number;
  pagination: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
}

/** COMMUNITY is the hero surface (Cat ID issued, made public, featured, milestones). */
function iconFor(category: string) {
  switch (category.toUpperCase()) {
    case "COMMUNITY":
      return Heart;
    case "ORDER":
      return Package;
    case "DELIVERY":
      return Truck;
    case "BILLING":
    case "SUBSCRIPTION":
      return CreditCard;
    case "PROMOTION":
      return Megaphone;
    case "SUBSCRIPTION_UPDATE":
      return Repeat;
    default:
      return Bell;
  }
}

export default function NotificationsPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["notifications", user?.id, page],
    queryFn: () => authedFetch<NotificationsPage>(`/notifications?page=${page}`),
    enabled: !!user,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => authedFetch(`/notifications/${id}/read`, { method: "PATCH", body: "{}" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => authedFetch("/notifications/read-all", { method: "PATCH", body: "{}" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const fmtTime = (d: string) => formatDateTime(d, isAr ? "ar" : "en");

  const unread = data?.unread ?? 0;
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{isAr ? "الإشعارات" : "Notifications"}</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0
              ? isAr ? `${unread} غير مقروءة` : `${unread} unread`
              : isAr ? "كل شي تمام" : "You're all caught up"}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            {markAll.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
            {isAr ? "تحديد الكل كمقروء" : "Mark all read"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isError ? (
        <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
      ) : data && data.items.length > 0 ? (
        <>
          <Card className="divide-y divide-border p-0">
            {data.items.map((n) => {
              const Icon = iconFor(n.category);
              const isUnread = !n.readAt;
              const { title, body } = notificationText(n, isAr ? "ar" : "en");
              const href = notificationHref(n);
              const rowClass = cn(
                "flex w-full items-start gap-4 p-5 text-start transition-colors",
                isUnread
                  ? "border-s-2 border-s-primary bg-primary/[0.04] hover:bg-primary/[0.07]"
                  : "border-s-2 border-s-transparent hover:bg-muted/40",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              );
              const inner = (
                <>
                  <span className={cn("mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl", isUnread ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm", isUnread ? "font-semibold" : "font-medium")}>{title}</p>
                      {isUnread && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label={isAr ? "غير مقروءة" : "Unread"} />}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{fmtTime(n.createdAt)}</p>
                  </div>
                </>
              );
              // Actionable rows navigate to what they're about (and mark read on
              // the way); non-actionable rows are a plain mark-read button.
              return href ? (
                <Link
                  key={n.id}
                  href={href}
                  onClick={() => isUnread && markRead.mutate(n.id)}
                  className={rowClass}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  key={n.id}
                  type="button"
                  disabled={!isUnread || markRead.isPending}
                  onClick={() => isUnread && markRead.mutate(n.id)}
                  className={rowClass}
                >
                  {inner}
                </button>
              );
            })}
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="size-4 rtl:rotate-180" /> {isAr ? "السابق" : "Previous"}
              </Button>
              <span className="text-xs text-muted-foreground">{isAr ? `${page} من ${totalPages}` : `${page} of ${totalPages}`}</span>
              <Button variant="outline" size="sm" disabled={!data.pagination.hasMore || isFetching} onClick={() => setPage((p) => p + 1)}>
                {isAr ? "التالي" : "Next"} <ChevronRight className="size-4 rtl:rotate-180" />
              </Button>
            </div>
          )}
        </>
      ) : (
        /* Empty state = a welcome, not a void (R111). */
        <Card className="relative flex flex-col items-center gap-4 overflow-hidden p-10 text-center">
          <IlloPaw tone="butter" className="pointer-events-none absolute start-8 top-6 size-8 rotate-[-14deg] opacity-60" />
          <IlloPaw tone="peach" className="pointer-events-none absolute bottom-6 end-10 size-7 rotate-[18deg] opacity-60" />
          <IlloMouse tone="sage" className="h-16 w-auto" />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {isAr ? "كل شي تمام — حين يحدث شيء يخص قطك ستجده هنا" : "You're all caught up — when something happens for your cat, it lands here"}
          </p>
          <Link href="/portal"><Button variant="outline" size="sm">{isAr ? "ارجع إلى لوحتك" : "Back to your dashboard"}</Button></Link>
        </Card>
      )}
    </div>
  );
}
