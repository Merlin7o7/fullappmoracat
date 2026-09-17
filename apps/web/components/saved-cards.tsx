"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Trash2, RefreshCcw } from "lucide-react";
import { Card, Button, Skeleton, Dialog, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { commerceEnabled } from "@/lib/features";
import { friendlyError } from "@/lib/errors";

export interface SavedCard {
  id: string;
  provider: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  renewingSubscriptionIds: string[];
}

export function useSavedCards(enabled = true) {
  const { authedFetch, user } = useAuth();
  return useQuery({
    queryKey: ["payment-methods", user?.id],
    queryFn: () => authedFetch<SavedCard[]>("/account/payment-methods"),
    enabled: !!user && enabled && commerceEnabled(),
  });
}

export function brandLabel(brand: string | null, provider: string): string {
  const b = (brand ?? provider).toLowerCase();
  if (b.includes("mada")) return "mada";
  if (b.includes("master")) return "Mastercard";
  if (b.includes("visa")) return "Visa";
  if (b.includes("apple")) return "Apple Pay";
  return brand ?? provider;
}

/**
 * Saved cards (T7). Only brand + last 4 ever reach the browser — the token
 * lives with the PSP. A card exists here only because the member ticked
 * "renew automatically" at a card checkout; removing it drops every
 * membership that renews on it back to an invitation (never a silent gap).
 */
export function SavedCardsSection({ isAr }: { isAr: boolean }) {
  const { authedFetch } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const cards = useSavedCards();
  const [removing, setRemoving] = React.useState<SavedCard | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => authedFetch(`/account/payment-methods/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payment-methods"] });
      void qc.invalidateQueries({ queryKey: ["subscriptions"] });
      setRemoving(null);
      toast({ title: isAr ? "حذفنا البطاقة" : "Card removed", variant: "success" });
    },
    onError: (e) => {
      const fe = friendlyError(e, isAr);
      toast({ title: fe.title, description: fe.message, variant: "error" });
    },
  });

  if (!commerceEnabled()) return null;

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <CreditCard className="size-4 text-primary" aria-hidden />
        <h2 className="font-display text-lg font-semibold">{isAr ? "البطاقات المحفوظة" : "Saved cards"}</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {isAr
          ? "نحفظ بطاقة فقط عندما تختار «جدّد تلقائياً» عند الدفع. رقم البطاقة كاملاً لا يصلنا أبداً."
          : "A card is saved only when you choose “renew automatically” at checkout. The full card number never reaches us."}
      </p>

      {cards.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : !cards.data?.length ? (
        <p className="text-sm text-muted-foreground">{isAr ? "لا توجد بطاقات محفوظة." : "No saved cards."}</p>
      ) : (
        <ul className="space-y-2">
          {cards.data.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                <CreditCard className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium" dir="ltr">
                  {brandLabel(c.brand, c.provider)} •••• {c.last4 ?? "????"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {c.expMonth && c.expYear ? <span dir="ltr">{String(c.expMonth).padStart(2, "0")}/{String(c.expYear).slice(-2)}</span> : null}
                  {c.renewingSubscriptionIds.length > 0 && (
                    <>
                      {c.expMonth ? " · " : ""}
                      <RefreshCcw className="inline size-3 align-[-2px]" aria-hidden />{" "}
                      {isAr ? "تُستخدم للتجديد التلقائي" : "used for auto-renew"}
                    </>
                  )}
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setRemoving(c)} aria-label={isAr ? "حذف البطاقة" : "Remove card"}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={isAr ? "حذف البطاقة؟" : "Remove this card?"}
        description={
          removing?.renewingSubscriptionIds.length
            ? isAr
              ? "العضوية التي تتجدد على هذه البطاقة لن تتجدد تلقائياً بعد الآن — ندعوك قبل نهاية مدتها بدلاً من ذلك."
              : "The membership renewing on this card will stop renewing itself — we'll invite you before its term ends instead."
            : isAr
              ? "لن نقدر نستخدمها للتجديد بعد الآن."
              : "We won't be able to use it for renewals any more."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>{isAr ? "إبقاء" : "Keep"}</Button>
            <Button variant="destructive" loading={remove.isPending} onClick={() => removing && remove.mutate(removing.id)}>
              {isAr ? "حذف" : "Remove"}
            </Button>
          </>
        }
      />
    </Card>
  );
}
