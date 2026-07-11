"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, MailCheck } from "lucide-react";
import { Button, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { AuthShell } from "@/components/auth-shell";
import { OtpBoxes } from "@/components/otp-boxes";

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={null}>
      <VerifyEmailInner />
    </React.Suspense>
  );
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
  const sentOnce = React.useRef(false);

  // Not signed in → nowhere to verify. Already verified → move along.
  React.useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
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
        if (!silent) toast({ title: e instanceof Error ? e.message : "Failed", variant: "error" });
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
        setError(e instanceof Error ? e.message : isAr ? "رمز غير صحيح" : "Invalid code");
        setCode("");
      } finally {
        setVerifying(false);
      }
    },
    [authedFetch, updateUser, router, next, isAr]
  );

  // Escape hatch for a mistyped email (R112/R117): seed the register page's
  // draft (same key it reads on mount) with what we already know, so they only
  // fix the email — never retype everything.
  const fixEmail = React.useCallback(() => {
    try {
      const dialCode = user?.dialCode || "+966";
      const phone = user?.phone?.startsWith(dialCode) ? user.phone.slice(dialCode.length) : user?.phone ?? "";
      localStorage.setItem(
        "moraqat.signupDraft",
        JSON.stringify({
          fullName: [user?.firstName, user?.lastName].filter(Boolean).join(" "),
          dialCode,
          phone,
          email: user?.email ?? "",
        })
      );
    } catch { /* ignore */ }
    router.push("/register");
  }, [user, router]);

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

        <button
          type="button"
          onClick={() => send(false)}
          disabled={cooldown > 0}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
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
        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="text-xs text-muted-foreground">
            {isAr ? "ما وصلك شيء؟ شيّك على مجلد الرسائل غير المرغوبة." : "Nothing arriving? Check your spam folder."}
          </p>
          <button
            type="button"
            onClick={fixEmail}
            className="text-xs font-medium text-primary hover:underline"
          >
            {isAr ? "كتبت البريد غلط؟ عدّله من هنا" : "Wrong email? Fix it here"}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
