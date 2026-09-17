"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Copy, Check } from "lucide-react";
import { qrValueFor } from "@moraqat/core";
import { Button, Card, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useCats } from "@/lib/cat-context";
import { friendlyError } from "@/lib/errors";
import { formatDate } from "@/lib/datetime";

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
          <button type="button" className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border px-2" onClick={() => { void navigator.clipboard?.writeText(publicUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />} {copied ? (isAr ? "نُسخ" : "Copied") : (isAr ? "نسخ" : "Copy")}
          </button>
        </div>
      )}
    </Card>
  );
}
