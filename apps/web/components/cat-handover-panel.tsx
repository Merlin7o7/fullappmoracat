"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, History, Loader2, Search, Send, X } from "lucide-react";
import { Button, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { friendlyMessage } from "@/lib/errors";
import { formatDate } from "@/lib/datetime";
import { transferStatusLabel, type MyTransfers, type OwnershipHistory } from "@/lib/cat-life-api";

/**
 * Handing a cat on — from inside the cat's own manage panel, where the person
 * who owns them already is.
 *
 * THE TWO CONFIRMATIONS (R116)
 *   1. Here: type the cat's name. Not a checkbox — a checkbox is one careless
 *      tap, and this is the most irreversible action in Moracat.
 *   2. There: the recipient accepts from their own account, at the address the
 *      offer was sent to.
 * The server enforces both; this form is the human half of the first one.
 *
 * WHAT THE PANEL PROMISES OUT LOUD, before anyone types anything: the Cat ID
 * number does not change, the record goes with the cat, and the person handing
 * them over loses access. Saying that plainly up front is what makes the action
 * safe to offer at all (R006, R004 trust precedes the ask).
 */
export function CatHandoverPanel({
  catId,
  catName,
  isAr,
  onDone,
}: {
  catId: string;
  catName: string;
  isAr: boolean;
  onDone?: () => void;
}) {
  const { authedFetch } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [note, setNote] = React.useState("");
  const [confirmName, setConfirmName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Anything already in flight for THIS cat — so the panel shows the live offer
  // rather than silently letting someone send a second one.
  const transfers = useQuery({
    queryKey: ["my-transfers"],
    queryFn: () => authedFetch<MyTransfers>("/transfers"),
  });
  const pending = transfers.data?.outgoing.find((t) => t.cat.id === catId && t.status === "PENDING");

  const history = useQuery({
    queryKey: ["cat-ownership-history", catId],
    queryFn: () => authedFetch<OwnershipHistory>(`/cats/${catId}/ownership-history`),
  });

  const start = useMutation({
    mutationFn: () =>
      authedFetch<{ toEmail: string; recipientHasAccount: boolean }>(`/cats/${catId}/transfer`, {
        method: "POST",
        body: JSON.stringify({
          toEmail: email.trim(),
          confirmCatName: confirmName.trim(),
          reason: "REHOME",
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      }),
    onSuccess: (res) => {
      setOpen(false);
      setEmail("");
      setNote("");
      setConfirmName("");
      toast({
        title: isAr ? "أرسلنا العرض" : "The offer is on its way",
        description: res.recipientHasAccount
          ? isAr
            ? `أبلغنا ${res.toEmail} — ${catName} ينتقل لهم أول ما يقبلون.`
            : `We've told ${res.toEmail} — ${catName} moves the moment they accept.`
          : isAr
            ? `أرسلنا دعوة إلى ${res.toEmail}. يسوّون حساباً ويقبلون، وينتقل ${catName} لهم.`
            : `We've emailed an invitation to ${res.toEmail}. They create an account, accept, and ${catName} is theirs.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["my-transfers"] });
      onDone?.();
    },
    onError: (err) => setError(friendlyMessage(err, isAr)),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => authedFetch(`/transfers/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast({
        title: isAr ? "سحبنا العرض" : "Offer withdrawn",
        description: isAr ? `${catName} باقٍ عندك.` : `${catName} stays with you.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["my-transfers"] });
    },
  });

  const nameMatches = confirmName.trim().toLocaleLowerCase() === catName.trim().toLocaleLowerCase();
  const canSend = nameMatches && /.+@.+\..+/.test(email.trim());
  const past = history.data?.items ?? [];

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{isAr ? "نقل الملكية" : "Hand over"}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {isAr
              ? `تنقل ${catName} لعضو ثاني — بهويته ورقمها نفسه وسجله كاملاً. بعد النقل ما تقدر توصل لملفه.`
              : `Move ${catName} to another member — same Cat ID, same number, whole record. After it lands, you can no longer open their file.`}
          </p>
        </div>
      </div>

      {/* A live offer: the state, and the way out of it. */}
      {pending ? (
        <div className="rounded-xl bg-muted/60 p-3 text-sm">
          <p className="font-medium">
            {isAr ? `عرض قائم إلى ${pending.toEmail}` : `Offer open to ${pending.toEmail}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isAr
              ? `${transferStatusLabel(pending.status, true)} · ينتهي ${formatDate(pending.expiresAt, "ar")}`
              : `${transferStatusLabel(pending.status, false)} · expires ${formatDate(pending.expiresAt, "en")}`}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 text-destructive hover:bg-destructive/10"
            onClick={() => cancel.mutate(pending.id)}
            disabled={cancel.isPending}
          >
            {cancel.isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
            {isAr ? "اسحب العرض" : "Withdraw the offer"}
          </Button>
        </div>
      ) : !open ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <ArrowRightLeft className="size-4" aria-hidden />
            {isAr ? "انقل الملكية" : "Transfer ownership"}
          </Button>
          <Link href="/portal/adoption">
            <Button variant="ghost" size="sm">
              <Search className="size-4" aria-hidden />
              {isAr ? "أو اعرضه للتبني" : "Or list for adoption"}
            </Button>
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start.mutate();
          }}
          className="space-y-3"
        >
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-foreground/80">
              {isAr ? "بريد المالك الجديد" : "The new owner's email"}
            </span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              placeholder="name@example.com"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              {isAr
                ? "ما يحتاج يكون عنده حساب — نرسل له دعوة."
                : "They don't need an account yet — we'll send an invitation."}
            </span>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-foreground/80">
              {isAr ? "رسالة لهم (اختياري)" : "A note for them (optional)"}
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={
                isAr
                  ? `أي شي يحتاجون يعرفونه عن ${catName} — أكله، عاداته، خوفه من شي…`
                  : `Anything they should know about ${catName} — their food, their habits, what frightens them…`
              }
              className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
            />
          </label>

          {/* The confirmation. Typed, not ticked. */}
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-foreground/80">
              {isAr ? `اكتب «${catName}» للتأكيد` : `Type “${catName}” to confirm`}
            </span>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              dir="auto"
              className={cn(
                "h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2",
                confirmName && !nameMatches ? "border-destructive" : "border-border"
              )}
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={!canSend || start.isPending}>
              {start.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {isAr ? "أرسل العرض" : "Send the offer"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              {isAr ? "تراجع" : "Cancel"}
            </Button>
          </div>
        </form>
      )}

      {/* Provenance — who has held this cat. Only ever first names. */}
      {past.length > 0 && (
        <details className="rounded-xl bg-muted/40 p-3">
          <summary className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-medium">
            <History className="size-4 text-muted-foreground" aria-hidden />
            {isAr ? "سجل الملكية" : "Ownership history"}
          </summary>
          <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            {history.data?.registeredAt && (
              <li>
                {isAr
                  ? `سُجّل في مرقط — ${formatDate(history.data.registeredAt, "ar")}`
                  : `Registered on Moracat — ${formatDate(history.data.registeredAt, "en")}`}
              </li>
            )}
            {past.map((row) => (
              <li key={row.id}>
                {isAr
                  ? `انتقل من ${row.from ?? "عضو"} إلى ${row.to ?? "عضو"} — ${formatDate(row.at, "ar")}`
                  : `Moved from ${row.from ?? "a member"} to ${row.to ?? "a member"} — ${formatDate(row.at, "en")}`}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
