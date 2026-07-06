"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";

/**
 * NotificationsBell — a quiet doorway to /portal/notifications with a live
 * unread badge. Polls gently (60s) and never shows a "0"; the badge only
 * appears when there's something waiting (R112: honest, not noisy).
 */
export function NotificationsBell({ className }: { className?: string }) {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const { data } = useQuery({
    queryKey: ["notifications-unread", user?.id],
    queryFn: () => authedFetch<{ unread: number }>("/notifications/unread-count"),
    enabled: !!user,
    refetchInterval: 60000,
  });

  const unread = data?.unread ?? 0;
  const label = isAr
    ? unread > 0
      ? `${unread} إشعارات غير مقروءة`
      : "الإشعارات"
    : unread > 0
      ? `${unread} unread notifications`
      : "Notifications";

  return (
    <Link
      href="/portal/notifications"
      aria-label={label}
      className={cn(
        "relative grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className
      )}
    >
      <Bell className="size-[18px]" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute end-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-accent-foreground ring-2 ring-background"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
