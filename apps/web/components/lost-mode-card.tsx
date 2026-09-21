"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Copy, Check, Megaphone, Phone } from "lucide-react";
import { qrValueFor } from "@moraqat/core";
import { Button, Card, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useCats } from "@/lib/cat-context";
import { friendlyError } from "@/lib/errors";
import { formatDate, relativeTime } from "@/lib/datetime";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";

/**
 * Lost mode (MRC-PROD-001 T6) — the Safety job of the Cat ID (R040). While
 * on, anyone who scans the collar QR sees a prominent "I found this cat"
 * form; the message reaches the owner without exposing them.
 */
export function LostModeCard({ catId, catName, qrToken, lostModeAt, isAr }: { catId: string; catName: string; qrToken: string | null; lostModeAt: string | null | undefined; isAr: boolean }) {
  const { authedFetch } = useAuth();
  const { refresh } = useCats();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const on = !!lostModeAt;
  const publicUrl = qrToken ? qrValueFor(SITE_URL, qrToken) : null;

  // Every message a finder left through the QR page. The notification carries
  // each one once; this is where they stay readable (R117).
  const reports = useQuery({
    queryKey: ["cat-found-reports", catId],
    queryFn: () =>
      authedFetch<{ items: { id: string; message: string; finderPhone: string | null; createdAt: string }[] }>(
        `/cats/${catId}/found-reports`
      ),
    // While the cat is lost the owner is watching this page — keep it fresh.
    refetchInterval: on ? 30_000 : false,
  });
  const items = reports.data?.items ?? [];

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => authedFetch(`/cats/${catId}/lost-mode`, { method: "PATCH", body: JSON.stringify({ enabled }) }),
    onSuccess: (_r, enabled) => {
      refresh();
      void qc.invalidateQueries({ queryKey: ["cats"] });
      toast({
        title: enabled ? (isAr ? `وضع الفقدان مفعّل لـ${catName}` : `Lost mode is on for ${catName}`) : (isAr ? `أهلاً بعودة ${catName} 🤍` : `Welcome home, ${catName} 🤍`),
        variant: "success",
      });
    },
    onError: (err) => { const e = friendlyError(err, isAr); toast({ title: e.title, description: e.message, variant: "error" }); },
  });

  return (
    <Card className={on ? "border-destructive/40 bg-destructive/[0.04] p-5" : "p-5"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={on ? "grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive" : "grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"}><Search className="size-5" /></span>
          <div>
            <h2 className="font-display text-lg font-semibold">{on ? (isAr ? `${catName} مفقود` : `${catName} is lost`) : (isAr ? "وضع الفقدان" : "Lost mode")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {on
                ? isAr ? `مفعّل منذ ${formatDate(lostModeAt!, "ar")}. من يمسح رمز الطوق يرى نموذج «وجدت هذا القط» ويصلك ما يكتبه فوراً — دون أن يعرف رقمك.` : `On since ${formatDate(lostModeAt!, "en")}. Whoever scans the collar sees an “I found this cat” form and you get their message immediately — without them learning your number.`
                : isAr ? "إذا ضاع، فعّله: تصبح صفحة القط العامة نداءً للعثور عليه، ويصلك أي بلاغ فوراً." : "If they go missing, switch this on: the public page becomes a call to find them, and any report reaches you immediately."}
            </p>
          </div>
        </div>
        <Button variant={on ? "outline" : "primary"} size="sm" loading={toggle.isPending} onClick={() => toggle.mutate(!on)} className="min-h-11">
          {on ? (isAr ? "عاد إلى البيت" : "Found — turn off") : (isAr ? "أبلغ عن فقدان" : "Report lost")}
        </Button>
      </div>
      {publicUrl && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{isAr ? "الصفحة العامة:" : "Public page:"}</span>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="break-all font-mono text-primary underline-offset-2 hover:underline" dir="ltr">{publicUrl}</a>
          <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border px-3" onClick={() => { void navigator.clipboard?.writeText(publicUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />} {copied ? (isAr ? "نُسخ" : "Copied") : (isAr ? "نسخ" : "Copy")}
          </button>
        </div>
      )}

      {/* The QR only helps when someone scans the collar. The board is what
          reaches the neighbourhood — one tap away, never a separate discovery. */}
      {on && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/70 p-3">
          <p className="min-w-0 flex-1 text-sm leading-relaxed">
            {isAr
              ? `انشر إعلاناً عن ${catName} في «مفقود وموجود» وشاركه في واتساب حيّك — هذا اللي يوصل للناس.`
              : `Post a notice for ${catName} on Lost & Found and share it to your neighbourhood WhatsApp — that is what reaches people.`}
          </p>
          <Link href="/portal/lost-found?kind=LOST">
            <Button size="sm" variant="brand" className="min-h-11">
              <Megaphone className="size-4" aria-hidden />
              {isAr ? "انشر إعلاناً" : "Post a notice"}
            </Button>
          </Link>
        </div>
      )}

      {(on || items.length > 0) && (
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">
            {isAr ? "بلاغات وصلتك من رمز الطوق" : "Reports from the collar QR"}
          </h3>
          {reports.isError ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {isAr ? "ما قدرنا نحمّل البلاغات. " : "We couldn't load the reports. "}
              <button type="button" className="font-medium underline underline-offset-2" onClick={() => void reports.refetch()}>
                {isAr ? "حاول مرة ثانية" : "Try again"}
              </button>
            </p>
          ) : items.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {reports.isLoading
                ? isAr ? "نحمّل البلاغات…" : "Loading reports…"
                : isAr ? "ما وصل شي بعد. أول ما يكتب أحد من صفحة القط، تلقاه هنا ويوصلك إشعار." : "Nothing yet. The moment someone writes from the cat's page it appears here, and you get a notification."}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {items.map((r) => (
                <li key={r.id} className="rounded-xl border border-border bg-background p-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.message}</p>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{relativeTime(r.createdAt, isAr)}</span>
                    {r.finderPhone ? (
                      <a href={`tel:${r.finderPhone}`} dir="ltr" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary">
                        <Phone className="size-4" aria-hidden />
                        {r.finderPhone}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">{isAr ? "ما ترك رقماً" : "No number left"}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
