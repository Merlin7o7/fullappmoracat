"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, SkipForward, X, Repeat, Loader2, Truck } from "lucide-react";
import { Card, Badge, Button, Skeleton, Dialog, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";

interface Sub {
  id: string;
  status: string;
  interval: string;
  price: number;
  nextDeliveryAt: string | null;
  plan: { nameEn: string; nameAr: string } | null;
  cats: { id: string; name: string }[];
  items: { nameEn: string; quantity: number }[];
}

export default function SubscriptionsPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const [confirmCancel, setConfirmCancel] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["subscriptions", user?.id],
    queryFn: () => authedFetch<Sub[]>("/subscriptions"),
    enabled: !!user,
  });

  const labels: Record<string, { en: string; ar: string }> = {
    pause: { en: "Subscription paused", ar: "تم إيقاف الاشتراك" },
    resume: { en: "Subscription resumed", ar: "تم استئناف الاشتراك" },
    skip: { en: "Next delivery skipped", ar: "تم تخطي التوصيل القادم" },
    cancel: { en: "Subscription cancelled", ar: "تم إلغاء الاشتراك" },
  };

  const action = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: string }) =>
      authedFetch(`/subscriptions/${id}/${verb}`, { method: "POST", body: "{}" }),
    onSuccess: (_d, { verb }) => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      const l = labels[verb] ?? { en: "Done", ar: "تم" };
      toast({ title: isAr ? l.ar : l.en, variant: verb === "cancel" ? "default" : "success" });
    },
    onError: (e) => toast({ title: isAr ? "حدث خطأ" : "Something went wrong", description: e.message, variant: "error" }),
  });

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(isAr ? "ar-SA" : "en-GB", { day: "numeric", month: "short" }) : "—";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "الاشتراكات" : "Subscriptions"}</h1>
        <p className="text-sm text-muted-foreground">{isAr ? "أوقف أو تخطَّ أو ألغِ في أي وقت" : "Pause, skip or cancel anytime"}</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : data && data.length > 0 ? (
        data.map((sub) => (
          <Card key={sub.id} className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Repeat className="size-5" /></span>
                <div>
                  <p className="font-display font-semibold">{sub.plan ? (isAr ? sub.plan.nameAr : sub.plan.nameEn) : (isAr ? "صندوق مخصص" : "Custom box")}</p>
                  <p className="text-xs text-muted-foreground">{sub.price} SAR · {intervalLabel(sub.interval, isAr)}</p>
                </div>
              </div>
              <SubStatusBadge status={sub.status} isAr={isAr} />
            </div>

            <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2 rounded-xl bg-muted/50 p-4 text-sm">
              <span className="flex items-center gap-2"><Truck className="size-4 text-muted-foreground" /> {isAr ? "التوصيل القادم" : "Next"}: {fmtDate(sub.nextDeliveryAt)}</span>
              <span>{isAr ? "القطط" : "Cats"}: {sub.cats.map((c) => c.name).join(", ") || "—"}</span>
              <span>{isAr ? "العناصر" : "Items"}: {sub.items.length}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {sub.status === "ACTIVE" && (
                <>
                  <ActionBtn onClick={() => action.mutate({ id: sub.id, verb: "pause" })} pending={action.isPending} icon={Pause}>{isAr ? "إيقاف" : "Pause"}</ActionBtn>
                  <ActionBtn onClick={() => action.mutate({ id: sub.id, verb: "skip" })} pending={action.isPending} icon={SkipForward}>{isAr ? "تخطي" : "Skip"}</ActionBtn>
                </>
              )}
              {sub.status === "PAUSED" && (
                <ActionBtn onClick={() => action.mutate({ id: sub.id, verb: "resume" })} pending={action.isPending} icon={Play}>{isAr ? "استئناف" : "Resume"}</ActionBtn>
              )}
              {sub.status !== "CANCELLED" && (
                <ActionBtn variant="destructive" onClick={() => setConfirmCancel(sub.id)} pending={false} icon={X}>{isAr ? "إلغاء" : "Cancel"}</ActionBtn>
              )}
            </div>
          </Card>
        ))
      ) : (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-muted"><Repeat className="size-7 text-muted-foreground" /></span>
          <p className="text-sm text-muted-foreground">{isAr ? "لا توجد اشتراكات بعد" : "No subscriptions yet"}</p>
          <a href="/#plans"><Button size="sm">{isAr ? "تصفّح الباقات" : "Browse plans"}</Button></a>
        </Card>
      )}

      <Dialog
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        title={isAr ? "إلغاء الاشتراك؟" : "Cancel subscription?"}
        description={isAr ? "سيتوقف التوصيل والفوترة. يمكنك بدء اشتراك جديد لاحقاً." : "Deliveries and billing will stop. You can start a new subscription anytime."}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmCancel(null)}>{isAr ? "تراجع" : "Keep it"}</Button>
            <Button
              variant="destructive"
              loading={action.isPending}
              onClick={() => { if (confirmCancel) action.mutate({ id: confirmCancel, verb: "cancel" }); setConfirmCancel(null); }}
            >
              {isAr ? "نعم، ألغِ" : "Yes, cancel"}
            </Button>
          </>
        }
      />
    </div>
  );
}

function ActionBtn({ onClick, pending, icon: Icon, children, variant = "outline" }: { onClick: () => void; pending: boolean; icon: typeof Pause; children: React.ReactNode; variant?: "outline" | "destructive" }) {
  return (
    <Button variant={variant} size="sm" onClick={onClick} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />} {children}
    </Button>
  );
}

function SubStatusBadge({ status, isAr }: { status: string; isAr: boolean }) {
  const map: Record<string, { variant: "success" | "secondary" | "destructive"; en: string; ar: string }> = {
    ACTIVE: { variant: "success", en: "Active", ar: "نشط" },
    PAUSED: { variant: "secondary", en: "Paused", ar: "موقوف" },
    CANCELLED: { variant: "destructive", en: "Cancelled", ar: "ملغى" },
  };
  const s = map[status] ?? { variant: "secondary" as const, en: status, ar: status };
  return <Badge variant={s.variant}>{isAr ? s.ar : s.en}</Badge>;
}

function intervalLabel(interval: string, isAr: boolean) {
  const map: Record<string, [string, string]> = {
    MONTHLY: ["Monthly", "شهري"], BIMONTHLY: ["Every 2 months", "كل شهرين"],
    QUARTERLY: ["Quarterly", "ربع سنوي"], CUSTOM: ["Custom", "مخصص"],
  };
  const [en, ar] = map[interval] ?? [interval, interval];
  return isAr ? ar : en;
}
