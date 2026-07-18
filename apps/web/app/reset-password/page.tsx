"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, MailCheck } from "lucide-react";
import { Button, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field } from "@/components/field";
import { AuthShell } from "@/components/auth-shell";
import { friendlyError } from "@/lib/errors";

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<div className="grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
      <ResetPasswordInner />
    </React.Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const { resetPassword, forgotPassword, user } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  // A dead link isn't a dead end (R112): TOKEN_INVALID/TOKEN_EXPIRED swap the
  // form for a one-tap "send me a fresh link" recovery state.
  const [deadToken, setDeadToken] = React.useState<null | "TOKEN_INVALID" | "TOKEN_EXPIRED">(null);
  const [recoveryEmail, setRecoveryEmail] = React.useState("");
  const [resending, setResending] = React.useState(false);
  const [resent, setResent] = React.useState(false);

  // Prefill the recovery email when we already know who this is.
  React.useEffect(() => {
    if (user?.email) setRecoveryEmail((e) => e || user.email);
  }, [user?.email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError(isAr ? "كلمتا المرور غير متطابقتين" : "Passwords don't match"); return; }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      toast({ title: isAr ? "تم تحديث كلمة المرور" : "Password updated", variant: "success" });
      // /login?reason=password-changed shows its friendly banner (R112).
      setTimeout(() => router.push("/login?reason=password-changed"), 1400);
    } catch (err) {
      const fe = friendlyError(err, isAr);
      if (fe.code === "TOKEN_INVALID" || fe.code === "TOKEN_EXPIRED") {
        setDeadToken(fe.code);
      } else {
        setError(fe.message);
      }
    } finally { setLoading(false); }
  }

  async function resendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResending(true);
    try {
      const { devToken } = await forgotPassword(recoveryEmail);
      setResent(true);
      toast({
        title: isAr ? "إذا كان البريد مسجّلاً، أرسلنا رابطاً جديداً" : "If that email exists, we sent a fresh link",
        variant: "success",
      });
      if (devToken) router.push(`/reset-password?token=${devToken}`);
    } catch (err) {
      setError(friendlyError(err, isAr).message);
    } finally { setResending(false); }
  }

  if (!token || deadToken) {
    const expired = deadToken === "TOKEN_EXPIRED";
    return (
      <AuthShell
        isAr={isAr}
        title={expired ? (isAr ? "انتهت صلاحية الرابط" : "That link expired") : (isAr ? "الرابط غير صالح" : "That link isn't valid")}
        subtitle={isAr ? "ولا يحتاج أكثر من رابط جديد — نرسله لك فوراً" : "All you need is a fresh link — we'll send one right away"}
      >
        {resent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary"><MailCheck className="size-6" /></span>
            <p className="text-sm text-muted-foreground">
              {isAr ? "افتح بريدك واتبع الرابط الجديد — يوصل خلال ثوانٍ." : "Open your email and follow the new link — it arrives in seconds."}
            </p>
            <Link href="/login" className="min-h-[44px] pt-2 text-sm font-medium text-primary hover:underline">
              {isAr ? "الرجوع لتسجيل الدخول" : "Back to login"}
            </Link>
          </div>
        ) : (
          <form onSubmit={resendLink} className="flex flex-col gap-4">
            <Field label={isAr ? "البريد الإلكتروني" : "Email"} type="email" required value={recoveryEmail} onChange={setRecoveryEmail} placeholder="you@example.com" autoComplete="email" />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" disabled={resending}>
              {resending && <Loader2 className="size-4 animate-spin" />}
              {isAr ? "أرسل لي رابطاً جديداً" : "Send me a new link"}
            </Button>
            <Link href="/login" className="min-h-[44px] self-center text-sm text-muted-foreground transition-colors hover:text-foreground">
              {isAr ? "الرجوع لتسجيل الدخول" : "Back to login"}
            </Link>
          </form>
        )}
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell isAr={isAr} title={isAr ? "تم — كل شيء تمام" : "All set"} subtitle={isAr ? "نوجّهك لتسجيل الدخول…" : "Taking you to login…"}>
        <div className="grid place-items-center py-6 text-success"><CheckCircle2 className="size-10" /></div>
      </AuthShell>
    );
  }

  return (
    <AuthShell isAr={isAr} title={isAr ? "كلمة مرور جديدة" : "Set a new password"} subtitle={isAr ? "اختر كلمة مرور قوية لحسابك" : "Choose a strong password for your account"}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label={isAr ? "كلمة المرور الجديدة" : "New password"} type="password" required value={password} onChange={setPassword} placeholder={isAr ? "٨ أحرف على الأقل" : "At least 8 characters"} autoComplete="new-password" />
        <Field label={isAr ? "تأكيد كلمة المرور" : "Confirm password"} type="password" required value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" disabled={loading}>{loading && <Loader2 className="size-4 animate-spin" />}{isAr ? "تحديث كلمة المرور" : "Update password"}</Button>
      </form>
    </AuthShell>
  );
}
