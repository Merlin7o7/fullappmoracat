"use client";

/**
 * Claiming a clinic-created cat (MRC-PROD-001 T4).
 *
 * The clinic registered the cat at the counter and handed the owner this
 * link. The page says what it is BEFORE asking for anything (R004): the cat,
 * the clinic, the last four digits of the number it went to. Then one of two
 * doors — sign in or create an account — and the claim itself, which needs
 * proof of that number: the account already holds it, or a one-time code.
 * The Cat ID is issued on claim, the same number the ceremony celebrates.
 */

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BadgeCheck, Loader2, MessageSquare, ShieldCheck, Stethoscope } from "lucide-react";
import { Avatar, Button, Card, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { ApiError } from "@/lib/http";
import { friendlyError } from "@/lib/errors";
import { formatDate } from "@/lib/datetime";
import { OtpBoxes } from "@/components/otp-boxes";
import { track } from "@/lib/track";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

interface Preview {
  state: "valid" | "expired" | "claimed" | "revoked";
  cat: { name: string; photoUrl: string | null };
  clinic: { ar: string; en: string };
  phoneLast4: string;
  expiresAt: string;
}

type Candidate = { id: string; name: string; catIdNumber: string | null; photoUrl: string | null };

export default function ClaimPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { user, ready, authedFetch } = useAuth();
  const { refresh } = useCats();
  const { toast } = useToast();

  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [needsOtp, setNeedsOtp] = React.useState(false);
  const [otpSent, setOtpSent] = React.useState(false);
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [candidates, setCandidates] = React.useState<Candidate[] | null>(null);
  const [mergeInto, setMergeInto] = React.useState<string | "new" | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/api/claim/${encodeURIComponent(token)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as Preview) : null))
      .then((p) => {
        if (cancelled) return;
        if (!p) setNotFound(true);
        else setPreview(p);
        track("claim_page_viewed", { state: p?.state ?? "not_found" });
      })
      .catch(() => !cancelled && setNotFound(true));
    return () => { cancelled = true; };
  }, [token]);

  const next = `/claim/${token}`;

  async function sendOtp() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}/api/claim/${encodeURIComponent(token)}/otp`, { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { devCode?: string };
      if (!r.ok) throw new Error("otp");
      setOtpSent(true);
      setDevCode(j.devCode ?? null);
    } catch {
      setError(isAr ? "تعذّر إرسال الرمز. حاول بعد دقيقة." : "Couldn't send the code. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  async function accept(opts: { otp?: string; mergeIntoCatId?: string } = {}) {
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch<{ catId: string; catIdNumber: string | null; merged: boolean; name: string }>(
        `/claim/${encodeURIComponent(token)}/accept`,
        { method: "POST", body: JSON.stringify({ ...(opts.otp ? { phoneOtpCode: opts.otp } : {}), ...(opts.mergeIntoCatId ? { mergeIntoCatId: opts.mergeIntoCatId } : {}) }) }
      );
      refresh();
      toast({
        title: res.merged ? (isAr ? `أُضيف سجل العيادة إلى ${res.name}` : `The clinic's record was added to ${res.name}`) : (isAr ? `هوية ${res.name} صدرت 🐾` : `${res.name}'s Cat ID is issued 🐾`),
        variant: "success",
      });
      router.push(`/portal/cats/${res.catId}/health`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "CLAIM_PHONE_MISMATCH") { setNeedsOtp(true); setBusy(false); return; }
        if (err.code === "CLAIM_POSSIBLE_DUPLICATE") {
          setCandidates(((err.extras?.candidates as Candidate[] | undefined) ?? []));
          setBusy(false);
          return;
        }
      }
      setError(friendlyError(err, isAr).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      {notFound ? (
        <Card className="p-8 text-center">
          <p className="font-display text-lg font-semibold">{isAr ? "هذا الرابط غير صالح" : "This link isn't valid"}</p>
          <p className="mt-2 text-sm text-muted-foreground">{isAr ? "اطلب من العيادة رابطاً جديداً، أو سجّل قطك بنفسك." : "Ask the clinic for a new one, or register your cat yourself."}</p>
          <Link href="/register" className="mt-4 inline-block"><Button>{isAr ? "سجّل قطك" : "Register your cat"}</Button></Link>
        </Card>
      ) : !preview ? (
        <div className="grid place-items-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-5">
          {/* What this is — before any ask (R004). */}
          <Card className="p-6 text-center">
            <Avatar name={preview.cat.name} src={preview.cat.photoUrl} size="lg" className="mx-auto rounded-2xl" />
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">
              {isAr ? `${preview.cat.name} بانتظارك` : `${preview.cat.name} is waiting for you`}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <Stethoscope className="me-1 inline size-4 align-text-bottom text-primary" />
              {isAr
                ? `${preview.clinic.ar} سجّلت ${preview.cat.name} في مُراقط وأرسلت هذا الرابط للرقم المنتهي بـ ${preview.phoneLast4}.`
                : `${preview.clinic.en} registered ${preview.cat.name} on Moracat and sent this link to the number ending ${preview.phoneLast4}.`}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {isAr ? `الرابط صالح حتى ${formatDate(preview.expiresAt, "ar")}` : `Valid until ${formatDate(preview.expiresAt, "en")}`}
            </p>
          </Card>

          {preview.state !== "valid" ? (
            <Card className="p-5 text-center text-sm text-muted-foreground">
              {preview.state === "claimed"
                ? isAr ? "هذا القط مُستلَم بالفعل. إن كان قطك ولم تستلمه أنت، تواصل معنا." : "This cat has already been claimed. If it's yours and you didn't claim it, contact us."
                : isAr ? "انتهت صلاحية هذا الرابط. اطلب من العيادة إرسال رابط جديد." : "This link has expired. Ask the clinic to send a new one."}
            </Card>
          ) : !ready ? null : !user ? (
            <Card className="space-y-3 p-5">
              <p className="text-sm leading-relaxed">
                {isAr ? "لاستلام هوية قطك تحتاج حساباً في مُراقط — دقيقة واحدة." : "To claim your cat's ID you need a Moracat account — it takes a minute."}
              </p>
              <Link href={`/register?next=${encodeURIComponent(next)}`} className="block"><Button className="w-full">{isAr ? "أنشئ حساباً واستلم" : "Create an account and claim"}</Button></Link>
              <Link href={`/login?next=${encodeURIComponent(next)}`} className="block"><Button variant="outline" className="w-full">{isAr ? "عندي حساب — تسجيل الدخول" : "I have an account — sign in"}</Button></Link>
            </Card>
          ) : candidates ? (
            <Card className="space-y-3 p-5">
              <p className="text-sm font-medium">{isAr ? `عندك قط اسمه ${preview.cat.name} بالفعل. هل هذا هو نفسه؟` : `You already have a cat named ${preview.cat.name}. Is this the same cat?`}</p>
              <div className="space-y-2">
                {candidates.map((c) => (
                  <button key={c.id} type="button" onClick={() => setMergeInto(c.id)} className={cn("flex w-full min-h-12 items-center gap-3 rounded-xl border px-3 text-start text-sm", mergeInto === c.id ? "border-primary bg-primary/5" : "border-border")}>
                    <Avatar name={c.name} src={c.photoUrl} size="sm" />
                    <span className="flex-1">{c.name}</span>
                    <span className="font-mono text-xs text-muted-foreground" dir="ltr">{c.catIdNumber}</span>
                  </button>
                ))}
                <button type="button" onClick={() => setMergeInto("new")} className={cn("w-full min-h-12 rounded-xl border px-3 text-start text-sm", mergeInto === "new" ? "border-primary bg-primary/5" : "border-border")}>
                  {isAr ? "لا — هذا قط آخر" : "No — this is a different cat"}
                </button>
              </div>
              <Button className="w-full" disabled={!mergeInto} loading={busy} onClick={() => accept({ otp: code || undefined, mergeIntoCatId: mergeInto === "new" ? undefined : mergeInto ?? undefined })}>
                {mergeInto === "new" ? (isAr ? "استلم كقط جديد" : "Claim as a new cat") : (isAr ? "أضف سجل العيادة إلى قطي" : "Add the clinic's record to my cat")}
              </Button>
              {mergeInto === "new" && (
                <p className="text-xs text-muted-foreground">{isAr ? "سنُصدر هوية جديدة ونحتفظ بالقط الحالي كما هو." : "We'll issue a new ID and leave your existing cat untouched."}</p>
              )}
            </Card>
          ) : needsOtp ? (
            <Card className="space-y-4 p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="size-4" /></span>
                <p className="text-sm leading-relaxed">
                  {isAr
                    ? `حسابك لا يحمل الرقم المنتهي بـ ${preview.phoneLast4}. أرسل رمز تحقق إلى ذلك الرقم لإثبات أنه لك.`
                    : `Your account doesn't hold the number ending ${preview.phoneLast4}. Send a code to that number to prove it's yours.`}
                </p>
              </div>
              {!otpSent ? (
                <Button className="w-full" loading={busy} onClick={sendOtp}><MessageSquare className="size-4" /> {isAr ? `أرسل الرمز إلى ••••${preview.phoneLast4}` : `Send the code to ••••${preview.phoneLast4}`}</Button>
              ) : (
                <div className="space-y-3">
                  <OtpBoxes value={code} onChange={setCode} />
                  {devCode && <p className="text-center font-mono text-xs text-muted-foreground">dev: {devCode}</p>}
                  <Button className="w-full" disabled={code.length < 4} loading={busy} onClick={() => accept({ otp: code })}>{isAr ? "تحقّق واستلم" : "Verify and claim"}</Button>
                  <button type="button" className="w-full text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={sendOtp}>{isAr ? "أرسل رمزاً جديداً" : "Send a new code"}</button>
                </div>
              )}
            </Card>
          ) : (
            <Card className="space-y-3 p-5">
              <p className="text-sm leading-relaxed">
                {isAr ? `مسجّل الدخول باسم ${user.firstName ?? user.email}. استلم ${preview.cat.name} وسيصدر رقم هويته الآن.` : `Signed in as ${user.firstName ?? user.email}. Claim ${preview.cat.name} and the Cat ID is issued now.`}
              </p>
              <Button className="w-full" loading={busy} onClick={() => accept()}><BadgeCheck className="size-4" /> {isAr ? `استلم ${preview.cat.name}` : `Claim ${preview.cat.name}`}</Button>
            </Card>
          )}

          {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
        </div>
      )}
    </main>
  );
}
