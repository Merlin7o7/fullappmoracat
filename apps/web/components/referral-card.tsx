"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, Copy, Check } from "lucide-react";
import { Button, Card, Skeleton, useToast } from "@moraqat/ui";
import { formatNumber } from "@moraqat/core";
import { useAuth } from "@/lib/auth";

/** Belonging grows by invitation — the member's own link, shared natively. */
export function ReferralCard({ isAr }: { isAr: boolean }) {
  const { authedFetch, user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const { data } = useQuery({
    queryKey: ["referral", user?.id],
    queryFn: () => authedFetch<{ code: string; invited: number; link: string }>("/account/referral"),
    enabled: !!user,
  });

  const share = async () => {
    if (!data) return;
    const text = isAr
      ? `انضم لي في مرقط — عضوية وهوية لقطك: ${data.link}`
      : `Join me on Moracat — a membership and identity for your cat: ${data.link}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "Moracat", text, url: data.link }); return; } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      toast({ title: isAr ? "تم نسخ الرابط" : "Link copied", variant: "success" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: isAr ? "تعذّر النسخ" : "Couldn’t copy", variant: "error" });
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-6">
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary"><Gift className="size-5" aria-hidden /></span>
        <div>
          <p className="font-medium">{isAr ? "ادعُ صديقاً" : "Invite a friend"}</p>
          <p className="text-xs text-muted-foreground">{isAr ? "شارك مرقط مع محبّي القطط" : "Share Moracat with cat people"}</p>
        </div>
      </div>
      {data ? (
        <>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <code className="truncate font-mono text-sm" dir="ltr">{data.code}</code>
            {data.invited > 0 && (
              <span className="ms-2 shrink-0 text-xs text-muted-foreground">
                {isAr ? `دعوت ${formatNumber(data.invited, "ar")}` : `${data.invited} invited`}
              </span>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={share} className="w-fit">
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
