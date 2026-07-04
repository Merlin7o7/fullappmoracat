"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, CreditCard, Truck, Repeat, Megaphone, Info } from "lucide-react";
import { Card, Button, Skeleton, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { IlloMouse, IlloPaw } from "@/components/illustrations";

interface Notification {
  id: string;
  category: "ORDER" | "BILLING" | "PROMOTION" | "SUBSCRIPTION" | "DELIVERY" | "SYSTEM";
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

const ICONS = {
  ORDER: Package, BILLING: CreditCard, DELIVERY: Truck,
  SUBSCRIPTION: Repeat, PROMOTION: Megaphone, SYSTEM: Info,
} as const;

export default function NotificationsPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => authedFetch<Notification[]>("/account/notifications"),
    enabled: !!user,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => authedFetch(`/account/notifications/${id}/read`, { method: "POST", body: "{}" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const fmtTime = (d: string) =>
    new Date(d).toLocaleString(isAr ? "ar-SA" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const unread = data?.filter((n) => !n.readAt).length ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{isAr ? "الإشعارات" : "Notifications"}</h1>
        <p className="text-sm text-muted-foreground">
          {unread > 0
            ? isAr ? `${unread} غير مقروءة` : `${unread} unread`
            : isAr ? "كل شيء مقروء" : "All caught up"}
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : data && data.length > 0 ? (
        <Card className="divide-y divide-border p-0">
          {data.map((n) => {
            const Icon = ICONS[n.category] ?? Info;
            const isUnread = !n.readAt;
            return (
              <div key={n.id} className={cn("flex items-start gap-4 p-5", isUnread && "bg-primary/[0.04]")}>
                <span className={cn("mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl", isUnread ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm", isUnread ? "font-semibold" : "font-medium")}>{n.title}</p>
                    {isUnread && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label={isAr ? "غير مقروءة" : "Unread"} />}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{fmtTime(n.createdAt)}</p>
                </div>
                {isUnread && (
                  <Button variant="ghost" size="sm" onClick={() => markRead.mutate(n.id)} disabled={markRead.isPending}>
                    {isAr ? "قرأتها" : "Mark read"}
                  </Button>
                )}
              </div>
            );
          })}
        </Card>
      ) : (
        /* Empty state = a welcome, not a void (R111). */
        <Card className="relative flex flex-col items-center gap-4 overflow-hidden p-10 text-center">
          <IlloPaw tone="butter" className="pointer-events-none absolute start-8 top-6 size-8 rotate-[-14deg] opacity-60" />
          <IlloPaw tone="peach" className="pointer-events-none absolute bottom-6 end-10 size-7 rotate-[18deg] opacity-60" />
          <IlloMouse tone="sage" className="h-16 w-auto" />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {isAr ? "لا إشعارات بعد — حين يحدث شيء يخص قطك ستجده هنا" : "No notifications yet — when something happens for your cat, it lands here"}
          </p>
          <Link href="/portal"><Button variant="outline" size="sm">{isAr ? "ارجع إلى لوحتك" : "Back to your dashboard"}</Button></Link>
        </Card>
      )}
    </div>
  );
}
