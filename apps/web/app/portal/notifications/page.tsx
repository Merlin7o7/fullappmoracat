"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Package, CreditCard, Truck, Repeat, Megaphone, Info } from "lucide-react";
import { Card, Button, Skeleton, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";

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
        <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "الإشعارات" : "Notifications"}</h1>
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
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-muted"><Bell className="size-7 text-muted-foreground" /></span>
          <p className="text-sm text-muted-foreground">{isAr ? "لا إشعارات بعد" : "No notifications yet"}</p>
        </Card>
      )}
    </div>
  );
}
