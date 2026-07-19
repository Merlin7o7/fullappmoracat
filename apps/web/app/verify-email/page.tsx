"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, MailCheck, ExternalLink } from "lucide-react";
import { Button, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { AuthShell } from "@/components/auth-shell";
import { OtpBoxes } from "@/components/otp-boxes";
import { friendlyError, friendlyMessage } from "@/lib/errors";

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={<div className="grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
      <VerifyEmailInner />
    </React.Suspense>
  );
}

/** Webmail inboxes we can open in one tap, keyed off the email's domain. */
function inboxLink(email: string | undefined | null): { href: string; label: string } | null {
  const domain = email?.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return { href: "https://mail.google.com/mail/u/0/", label: "Gmail" };
  }
  if (["outlook.com", "outlook.sa", "hotmail.com", "live.com", "msn.com"].includes(domain)) {
    return { href: "https://outlook.live.com/mail/0/", label: "Outlook" };
  }
  if (["yahoo.com", "ymail.com"].includes(domain)) {
    return { href: "https://mail.yahoo.com/", label: "Yahoo Mail" };
  }
  return null;
}

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/portal";
  const { authedFetch, user, updateUser, ready } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";

  const [code, setCode] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);
  // Bumped after a wrong code — remounts OtpBoxes so autoFocus lands the member
  // back in box 1, ready to retype immediately (R112: every error is a recovery).
  const [attempt, setAttempt] = React.useState(0);
  const sentOnce = React.useRef(false);

  // Not signed in → nowhere to verify. Already verified → move along.
  React.useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login?next=%2Fverify-email");
    else if (user.emailVerified) router.replace(next);
  }, [ready, user, next, router]);

  const send = React.useCallback(
    async (silent = false) => {
      try {
        await authedFetch("/auth/email/otp/send", { method: "POST", body: "{}" });
        setCooldown(60);
        if (!silent) toast({ title: isAr ? "أرسلنا رمزاً جديداً" : "New code sent", variant: "success" });
      } catch (e) {
        // A cooldown error on the silent auto-send just means a code is already on its way.
        if (!silent) toast({ title: friendlyMessage(e, isAr), variant: "error" });
        else setCooldown(60);
      }
    },
    [authedFetch, isAr, toast]
  );

  // Auto-send once on mount (register already sent one; backend cooldown dedupes).
  React.useEffect(() => {
    if (ready && user && !user.emailVerified && !sentOnce.current) {
      sentOnce.current = true;
      void send(true);
    }
  }, [ready, user, send]);

  // Cooldown ticker.
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = React.useCallback(
    async (value: string) => {
      setError(null);
      setVerifying(true);
      try {
        await authedFetch("/auth/email/otp/verify", { method: "POST", body: JSON.stringify({ code: value }) });
        updateUser({ emailVerified: true });
        setDone(true);
        setTimeout(() => router.replace(next), 1100);
      } catch (e) {
        setError(friendlyError(e, isAr).message);
        setCode("");
        setAttempt((a) => a + 1); // remount the boxes → focus returns to box 1
      } finally {
        setVerifying(false);
      }
    },
    [authedFetch, updateUser, router, next, isAr]
  );

  // Mistyped email? Correct it IN PLACE (R112/R117): the API's
  // PATCH /auth/email updates the still-unverified address on the SAME account
  // (no duplicate account, no orphaned member number) and re-sends the code.
  const [fixing, setFixing] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");
  const [savingEmail, setSavingEmail] = React.useState(false);
  const saveEmail = React.useCallback(async () => {
    const email = newEmail.trim();
    if (!email) return;
    setSavingEmail(true);
    setError(null);
    try {
      await authedFetch("/auth/email", { method: "PATCH", body: JSON.stringify({ email }) });
      updateUser({ email });
      setFixing(false);
      setNewEmail("");
      setCode("");
      setAttempt((a) => a + 1);
      setCooldown(60);
      toast({
        title: isAr ? "عدّلنا بريدك وأرسلنا رمزاً جديداً" : "Email corrected — new code sent",
        variant: "success",
      });
    } catch (e) {
      setError(friendlyError(e, isAr).message);
    } finally {
      setSavingEmail(false);
    }
  }, [newEmail, authedFetch, updateUser, isAr, toast]);

  const inbox = inboxLink(user?.email);

  if (done) {
    return (
      <AuthShell
        isAr={isAr}
        title={isAr ? "تم تأكيد بريدك" : "Email confirmed"}
        subtitle={isAr ? "نكمل رحلتك…" : "Continuing…"}
      >
        <div className="grid place-items-center py-6 text-success">
          <CheckCircle2 className="size-12" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      isAr={isAr}
      title={isAr ? "أكّد بريدك" : "Verify your email"}
      subtitle={
        isAr
          ? `أدخل الرمز المكوّن من ٦ أرقام الذي أرسلناه إلى ${user?.email ?? "بريدك"}`
          : `Enter the 6-digit code we sent to ${user?.email ?? "your email"}`
      }
    >
      <div className="flex flex-col items-center gap-5">
        <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="size-6" />
        </span>

        <OtpBoxes
          key={attempt}
          value={code}
          onChange={setCode}
          onComplete={submit}
          disabled={verifying}
          isAr={isAr}
          autoFocus
        />

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <Button
          size="lg"
          className="w-full"
          disabled={code.length !== 6 || verifying}
          onClick={() => submit(code)}
        >
          {verifying ? <Loader2 className="size-4 animate-spin" /> : null}
          {isAr ? "تأكيد" : "Verify"}
        </Button>

        {/* One tap to the inbox where the code is waiting (R002). */}
        {inbox && (
          <a
            href={inbox.href}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            {isAr ? `افتح ${inbox.label}` : `Open ${inbox.label}`}
          </a>
        )}

        <button
          type="button"
          onClick={() => send(false)}
          disabled={cooldown > 0}
          className="min-h-[44px] text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        >
          {cooldown > 0
            ? isAr
              ? `إعادة الإرسال خلال ${cooldown} ثانية`
              : `Resend in ${cooldown}s`
            : isAr
              ? "إعادة إرسال الرمز"
              : "Resend code"}
        </button>

        {/* Quiet helpers — no one gets trapped here (R112/R113). */}
        <div className="flex w-full flex-col items-center gap-1.5 text-center">
          <p className="text-xs text-muted-foreground">
            {isAr ? "ما وصلك شيء؟ شيّك على مجلد الرسائل غير المرغوبة." : "Nothing arriving? Check your spam folder."}
          </p>
          {fixing ? (
            <div className="flex w-full max-w-xs flex-col gap-2">
              <label htmlFor="fix-email" className="sr-only">
                {isAr ? "البريد الصحيح" : "Corrected email"}
              </label>
              <input
                id="fix-email"
                type="email"
                dir="ltr"
                autoFocus
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void saveEmail(); }}
                placeholder={user?.email ?? "you@example.com"}
                className="min-h-[44px] rounded-xl border border-input bg-background px-3 text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex justify-center gap-2">
                <Button size="sm" onClick={() => void saveEmail()} loading={savingEmail} disabled={!newEmail.trim()}>
                  {isAr ? "عدّل وأرسل الرمز" : "Correct & resend code"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setFixing(false); setNewEmail(""); }}>
                  {isAr ? "إلغاء" : "Cancel"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isAr ? "نفس الحساب — فقط بريد صحيح ورمز جديد." : "Same account — just the corrected email and a fresh code."}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFixing(true)}
              className="min-h-[44px] text-xs font-medium text-primary hover:underline"
            >
              {isAr ? "كتبت البريد غلط؟ عدّله من هنا" : "Wrong email? Fix it here"}
            </button>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
