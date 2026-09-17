"use client";

/**
 * The counter's claim panel (MRC-PROD-001 T4). Shown on a clinic-created cat
 * until its owner claims it: a QR the owner scans right there, the link, and —
 * when the SMS flag is on — a send button with an honest budget. The token is
 * minted fresh each time the code is shown; the previous one stops working.
 */

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Check, MessageSquare, QrCode, Ticket } from "lucide-react";
import { Badge, Button, Card, Skeleton, useToast } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { formatDate } from "@/lib/datetime";
import { useVetActor, useVetApi, vetFriendlyError, type VetClaimLink } from "@/lib/vet-api";

export function ClaimPanel({ catId, autoOpen }: { catId: string; autoOpen?: boolean }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const api = useVetApi();
  const { can } = useVetActor();
  const { toast } = useToast();
  const [link, setLink] = React.useState<VetClaimLink | null>(null);
  const [copied, setCopied] = React.useState(false);

  const state = useQuery({ queryKey: ["vet-claim", catId], queryFn: () => api.getClaim(catId) });

  const refresh = useMutation({
    mutationFn: (sendSms: boolean) => api.refreshClaim(catId, { sendSms }),
    onSuccess: (res, sendSms) => {
      setLink(res);
      void state.refetch();
      if (sendSms) {
        toast({
          title: res.smsSent ? (isAr ? "أُرسل الرابط برسالة نصية" : "Link sent by SMS") : (isAr ? "لم تُرسل الرسالة" : "SMS not sent"),
          description: res.smsSent ? undefined : smsReason(res.smsReason, isAr),
          variant: res.smsSent ? "success" : "error",
        });
      }
    },
    onError: (err) => toast({ title: vetFriendlyError(err, isAr).message, variant: "error" }),
  });

  const opened = React.useRef(false);
  React.useEffect(() => {
    if (autoOpen && !opened.current && state.data?.state === "valid" && can("patient.create")) {
      opened.current = true;
      refresh.mutate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, state.data?.state]);

  if (state.isLoading) return <Skeleton className="h-16 rounded-2xl" />;
  const s = state.data;
  if (!s || s.state === "claimed" || s.state === "none") return null;

  const canShow = can("patient.create");
  return (
    <Card className="border-accent/40 bg-accent/[0.05] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent"><Ticket className="size-5" /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">{isAr ? "بانتظار استلام المالك" : "Waiting for the owner to claim"}</h2>
              <Badge variant={s.state === "valid" ? "warning" : "secondary"}>
                {s.state === "valid" ? (isAr ? "الرابط صالح" : "Link active") : s.state === "expired" ? (isAr ? "انتهى الرابط" : "Link expired") : (isAr ? "استُبدل الرابط" : "Link replaced")}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {isAr
                ? `الهوية تصدر عند الاستلام. الرابط للرقم المنتهي بـ ${s.phoneLast4} حتى ${formatDate(s.expiresAt, "ar")}. أُرسل ${s.sentCount} مرة.`
                : `The Cat ID is issued on claim. Link for the number ending ${s.phoneLast4}, valid until ${formatDate(s.expiresAt, "en")}. Sent ${s.sentCount}×.`}
            </p>
          </div>
        </div>
        {canShow && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" loading={refresh.isPending && !refresh.variables} onClick={() => refresh.mutate(false)}>
              <QrCode className="size-4" /> {isAr ? "اعرض رمز الاستلام" : "Show claim code"}
            </Button>
            {s.smsAvailable && (
              <Button size="sm" variant="outline" disabled={!s.canResend} loading={refresh.isPending && refresh.variables === true} onClick={() => refresh.mutate(true)}>
                <MessageSquare className="size-4" /> {isAr ? "أرسل برسالة" : "Send SMS"}
              </Button>
            )}
          </div>
        )}
      </div>

      {link && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-background p-4 sm:flex-row sm:items-start">
          <div className="rounded-xl bg-white p-2 ring-hairline">
            <QRCodeSVG value={link.url} size={168} level="M" bgColor="#ffffff" fgColor="#0b3b30" />
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-center sm:text-start">
            <p className="text-sm font-medium">{isAr ? "اطلب من المالك مسح الرمز بكاميرا الجوال" : "Ask the owner to scan this with their phone camera"}</p>
            <p className="break-all font-mono text-xs text-muted-foreground" dir="ltr">{link.url}</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(link.url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? (isAr ? "نُسخ" : "Copied") : (isAr ? "انسخ الرابط" : "Copy link")}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              {isAr ? "كل عرض جديد يبطل الرمز السابق." : "Each new code replaces the previous one."}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function smsReason(reason: VetClaimLink["smsReason"], isAr: boolean): string | undefined {
  switch (reason) {
    case "disabled": return isAr ? "الإرسال بالرسائل غير مفعّل بعد — اعرض الرمز للمالك." : "SMS sending isn't switched on yet — show the owner the code.";
    case "cap": return isAr ? "بلغنا الحد الأقصى للإرسال لهذا القط." : "The send limit for this cat has been reached.";
    case "cooldown": return isAr ? "أُرسل رابط خلال آخر ٢٤ ساعة — اعرض الرمز بدل ذلك." : "A link was sent in the last 24 hours — show the code instead.";
    case "provider": return isAr ? "تعذّر الإرسال من المزوّد. اعرض الرمز للمالك." : "The provider couldn't send it. Show the owner the code.";
    default: return undefined;
  }
}
