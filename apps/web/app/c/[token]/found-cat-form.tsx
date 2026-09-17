"use client";

import * as React from "react";
import { MessageSquareHeart, CheckCircle2 } from "lucide-react";
import { Button } from "@moraqat/ui";
import { Field } from "@/components/field";
import { track } from "@/lib/track";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** The finder's message to the owner — relayed, never a direct channel. */
export function FoundCatForm({ token, catName, isLost, isAr }: { token: string; catName: string; isLost: boolean; isAr: boolean }) {
  const [open, setOpen] = React.useState(isLost);
  const [message, setMessage] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { track("public_card_viewed", { lost: isLost }); }, [isLost]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/public/cats/${encodeURIComponent(token)}/found`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: message.trim(), ...(phone.trim() ? { finderPhone: phone.trim() } : {}) }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDone(true);
    } catch (err) {
      setError(
        String((err as Error).message) === "429" || String((err as Error).message) === "400"
          ? isAr ? "وصلت رسائل كثيرة لهذا القط اليوم — جرّب لاحقاً." : "Too many messages for this cat today — try again later."
          : isAr ? "تعذّر الإرسال. حاول مرة أخرى." : "Couldn't send. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <CheckCircle2 className="size-8 text-success" />
        <p className="text-sm font-medium">{isAr ? `وصلت رسالتك لعائلة ${catName}. شكراً لك 🤍` : `Your message reached ${catName}'s family. Thank you 🤍`}</p>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <MessageSquareHeart className="size-4" /> {isAr ? `وجدت ${catName}؟ أرسل رسالة للمالك` : `Found ${catName}? Message the owner`}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm font-medium">{isAr ? `أخبر عائلة ${catName} أين هو` : `Tell ${catName}'s family where they are`}</p>
      <Field label={isAr ? "رسالتك" : "Your message"} required value={message} onChange={setMessage} placeholder={isAr ? "وجدته قرب حديقة العليا، بخير ومعي." : "Found them near Al Olaya park, safe with me."} />
      <Field label={isAr ? "رقمك (اختياري — يراه المالك فقط)" : "Your number (optional — shown to the owner only)"} type="tel" inputMode="tel" value={phone} onChange={setPhone} placeholder="05…" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" loading={busy} disabled={message.trim().length < 2}>
        <MessageSquareHeart className="size-4" /> {isAr ? "أرسل للمالك" : "Send to the owner"}
      </Button>
      <p className="text-[11px] text-muted-foreground">{isAr ? "لا نشارك رقمك مع أحد سوى المالك، ولا نكشف لك بيانات المالك." : "Your number goes to the owner only, and the owner's details are never shown to you."}</p>
    </form>
  );
}
