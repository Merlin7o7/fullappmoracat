"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stethoscope, Copy, Check, Link2Off, Send } from "lucide-react";
import { Button, Card, StatusTag, useToast } from "@moraqat/ui";
import { formatDate, formatRelative } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";

interface ShareLink {
  id: string;
  expiresAt: string;
  revokedAt: string | null;
  includeContact: boolean;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
  active: boolean;
}

/**
 * "Send the record to a vet" — the non-partner door (UX reassessment §25.3):
 * any clinic in the Kingdom can read the cat's summary from one link, no
 * account needed. The owner picks how long it lives and whether their phone
 * is on it; sees every view; and can end it with one tap.
 */
export function VetShare({ catId, catName, isAr }: { catId: string; catName: string; isAr: boolean }) {
  const { authedFetch, user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const loc = isAr ? "ar" : "en";
  const key = ["share-links", catId];
  const [days, setDays] = React.useState(7);
  const [includeContact, setIncludeContact] = React.useState(false);
  const [fresh, setFresh] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const links = useQuery({
    queryKey: key,
    queryFn: () => authedFetch<ShareLink[]>(`/cats/${catId}/share-links`),
    enabled: !!user,
  });
  const fail = (e: unknown) => {
    const f = friendlyError(e, isAr);
    toast({ title: f.title, description: f.message, variant: "error" });
  };
  const create = useMutation({
    mutationFn: () => authedFetch<{ url: string }>(`/cats/${catId}/share-links`, { method: "POST", body: JSON.stringify({ days, includeContact }) }),
    onSuccess: (r) => {
      setFresh(r.url);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: fail,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => authedFetch(`/cats/${catId}/share-links/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      toast({ title: isAr ? "أُوقف الرابط" : "Link ended", variant: "success" });
    },
    onError: fail,
  });

  const message = fresh
    ? isAr
      ? `السلام عليكم، هذا الملخص الصحي لـ${catName} من مرقط: ${fresh}`
      : `Hello — here is ${catName}'s health summary from Moracat: ${fresh}`
    : "";
  const share = async () => {
    if (!fresh) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: isAr ? `ملخص ${catName} الصحي` : `${catName}'s health summary`, text: message, url: fresh });
        return;
      } catch {
        /* cancelled → fall through to copy */
      }
    }
    await navigator.clipboard?.writeText(fresh);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const active = (links.data ?? []).filter((l) => l.active);

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Stethoscope className="size-5" aria-hidden />
        </span>
        <div>
          <h3 className="font-medium">{isAr ? `أرسل سجل ${catName} لطبيب` : `Send ${catName}'s record to a vet`}</h3>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "رابط مؤقت يفتح ملخصاً صحياً نظيفاً — أي عيادة، بدون حساب. تشوف كل فتحة، وتوقفه متى شئت."
              : "A temporary link to a clean health summary — any clinic, no account. You see every view and can end it anytime."}
          </p>
        </div>
      </div>

      {fresh ? (
        <div className="space-y-3 rounded-md border border-primary/25 bg-primary/[0.05] p-4">
          <p className="text-sm font-medium">{isAr ? "الرابط جاهز — يظهر هنا مرة واحدة فقط" : "Your link is ready — it's shown only this once"}</p>
          <p dir="ltr" className="break-all rounded-md bg-card px-3 py-2 font-mono text-xs">{fresh}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="contextual" size="sm" onClick={share}>
              {copied ? <Check className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
              {copied ? (isAr ? "نُسخ" : "Copied") : isAr ? "أرسل للطبيب" : "Send to the vet"}
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-10 items-center rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
            >
              {isAr ? "واتساب" : "WhatsApp"}
            </a>
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(fresh);
                setCopied(true);
              }}
            >
              <Copy className="size-4" aria-hidden /> {isAr ? "نسخ" : "Copy"}
            </Button>
          </div>
          <Button variant="tertiary" size="sm" onClick={() => setFresh(null)}>
            {isAr ? "تم" : "Done"}
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-3"
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{isAr ? "مدة الرابط" : "How long it works"}</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 7, 30].map((d) => (
                <label
                  key={d}
                  className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/[0.07]"
                >
                  <input type="radio" name={`days-${catId}`} value={d} checked={days === d} onChange={() => setDays(d)} className="accent-[hsl(var(--primary))]" />
                  {d === 1 ? (isAr ? "يوم" : "1 day") : d === 7 ? (isAr ? "أسبوع" : "1 week") : isAr ? "شهر" : "1 month"}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={includeContact} onChange={(e) => setIncludeContact(e.target.checked)} className="size-4 accent-[hsl(var(--primary))]" />
            {isAr ? "أظهر رقم جوالي للعيادة" : "Show my phone number to the clinic"}
          </label>
          <Button type="submit" loading={create.isPending}>
            {isAr ? "أنشئ الرابط" : "Create the link"}
          </Button>
        </form>
      )}

      {active.length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm font-medium">{isAr ? "روابط فعّالة" : "Active links"}</p>
          <ul className="divide-y divide-border rounded-md border border-border">
            {active.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="text-sm">
                  <span className="text-muted-foreground">{isAr ? "أُنشئ" : "Created"} {formatDate(l.createdAt, loc, "short")}</span>
                  {" · "}
                  {l.viewCount > 0 ? (
                    <StatusTag tone="info">
                      {isAr ? `فُتح ${l.viewCount} مرة` : `Opened ${l.viewCount}×`}
                      {l.lastViewedAt ? ` · ${formatRelative(l.lastViewedAt, loc)}` : ""}
                    </StatusTag>
                  ) : (
                    <span className="text-muted-foreground">{isAr ? "لم يُفتح بعد" : "Not opened yet"}</span>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    {isAr ? "ينتهي" : "Ends"} {formatRelative(l.expiresAt, loc)}
                    {l.includeContact ? (isAr ? " · يظهر رقمك" : " · shows your number") : ""}
                  </span>
                </span>
                <Button variant="tertiary" size="sm" className="text-destructive" onClick={() => revoke.mutate(l.id)}>
                  <Link2Off className="size-4" aria-hidden /> {isAr ? "أوقفه" : "End it"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
