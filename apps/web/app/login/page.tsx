"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Smartphone } from "lucide-react";
import { Button, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field } from "@/components/field";
import { PhoneField, composePhone } from "@/components/phone-field";
import { GoogleButton } from "@/components/google-button";
import { AuthShell } from "@/components/auth-shell";

type Method = "email" | "phone";

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithPhone, loginWithGoogle, requestOtp, forgotPassword } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";

  const [method, setMethod] = React.useState<Method>("email");
  // Mobile + OTP login needs a live SMS provider; hide it until one is wired.
  const smsEnabled = process.env.NEXT_PUBLIC_SMS_ENABLED === "true";
  const [rememberMe, setRememberMe] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Email + password
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [totp, setTotp] = React.useState("");
  const [needsTotp, setNeedsTotp] = React.useState(false);

  // Phone + OTP
  const [dialCode, setDialCode] = React.useState("+966");
  const [phone, setPhone] = React.useState("");
  const [otpSent, setOtpSent] = React.useState(false);
  const [otp, setOtp] = React.useState("");

  // Forgot password
  const [forgot, setForgot] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState("");
  const fullPhone = composePhone(dialCode, phone);

  // A friendly reason banner when we bounced them here on purpose (e.g. after a
  // password change) — set in an effect to keep SSR/first paint identical.
  const [notice, setNotice] = React.useState<string | null>(null);
  React.useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "password-changed") {
      setNotice(isAr ? "تم تغيير كلمة المرور بنجاح. سجّل الدخول بكلمتك الجديدة." : "Your password was changed. Sign in with your new password.");
    }
  }, [isAr]);

  // Honour the ?next= the edge middleware appends so a bounced member lands back
  // where they were headed (only same-path internal targets, never an open
  // redirect). Read from the URL at call time — avoids the useSearchParams
  // Suspense requirement since this only runs after a user action.
  function goToPortal() {
    let dest = "/portal";
    if (typeof window !== "undefined") {
      const next = new URLSearchParams(window.location.search).get("next");
      if (next && next.startsWith("/") && !next.startsWith("//")) dest = next;
    }
    router.push(dest);
  }

  async function onEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      await login(email, password, { totp: totp || undefined, rememberMe });
      goToPortal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      if (/2fa/i.test(msg)) setNeedsTotp(true);
      setError(msg);
    } finally { setLoading(false); }
  }

  async function sendOtp() {
    setError(null);
    if (phone.replace(/\D/g, "").length < 8) { setError(isAr ? "رقم الجوال غير صحيح" : "Enter a valid mobile number"); return; }
    setLoading(true);
    try {
      const { devCode } = await requestOtp(fullPhone, "LOGIN");
      setOtpSent(true);
      if (devCode) toast({ title: isAr ? "رمز الدخول (وضع التطوير)" : "Login code (dev)", description: devCode });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally { setLoading(false); }
  }

  async function onPhoneLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!otpSent) return sendOtp();
    setError(null); setLoading(true);
    try {
      await loginWithPhone(fullPhone, otp, rememberMe);
      goToPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally { setLoading(false); }
  }

  async function onGoogle(idToken: string) {
    setError(null);
    try { await loginWithGoogle(idToken, rememberMe); goToPortal(); }
    catch (err) { setError(err instanceof Error ? err.message : "Google sign-in failed"); }
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const { devToken } = await forgotPassword(forgotEmail);
      toast({
        title: isAr ? "إذا كان البريد مسجّلاً، أرسلنا رابط الاستعادة" : "If that email exists, we sent a reset link",
        description: devToken ? (isAr ? "افتح الرابط لتعيين كلمة مرور جديدة" : "Open the link to set a new password") : undefined,
      });
      if (devToken) router.push(`/reset-password?token=${devToken}`);
      else setForgot(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  }

  if (forgot) {
    return (
      <AuthShell isAr={isAr} title={isAr ? "نسيت كلمة المرور؟" : "Forgot password?"} subtitle={isAr ? "أدخل بريدك ونرسل لك رابط الاستعادة" : "Enter your email and we'll send a reset link"}>
        <form onSubmit={onForgot} className="flex flex-col gap-4">
          <Field label={isAr ? "البريد الإلكتروني" : "Email"} type="email" required value={forgotEmail} onChange={setForgotEmail} placeholder="you@example.com" autoComplete="email" />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" disabled={loading}>{loading && <Loader2 className="size-4 animate-spin" />}{isAr ? "أرسل الرابط" : "Send reset link"}</Button>
          <button type="button" onClick={() => { setForgot(false); setError(null); }} className="text-sm text-muted-foreground hover:text-foreground">{isAr ? "الرجوع لتسجيل الدخول" : "Back to login"}</button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell isAr={isAr} title={isAr ? "مرحباً بعودتك" : "Welcome back"} subtitle={isAr ? "سجّل الدخول لإدارة عضويتك" : "Log in to manage your membership"}>
      {notice && (
        <div role="status" className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
          {notice}
        </div>
      )}
      <div className="mb-5"><GoogleButton isAr={isAr} onCredential={onGoogle} /></div>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{isAr ? "أو" : "or"}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Method switch — only when SMS OTP is available */}
      {smsEnabled && (
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          <MethodTab active={method === "email"} onClick={() => { setMethod("email"); setError(null); }} icon={Mail} label={isAr ? "البريد" : "Email"} />
          <MethodTab active={method === "phone"} onClick={() => { setMethod("phone"); setError(null); }} icon={Smartphone} label={isAr ? "الجوال" : "Mobile"} />
        </div>
      )}

      {!smsEnabled || method === "email" ? (
        <form onSubmit={onEmailLogin} className="mt-5 flex flex-col gap-4">
          <Field label={isAr ? "البريد الإلكتروني" : "Email"} type="email" required value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
          <Field label={isAr ? "كلمة المرور" : "Password"} type="password" required value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />
          {needsTotp && <Field label={isAr ? "رمز التحقق (2FA)" : "2FA code"} value={totp} onChange={setTotp} inputMode="numeric" placeholder="123456" />}
          <RememberRow isAr={isAr} rememberMe={rememberMe} setRememberMe={setRememberMe} onForgot={() => { setForgot(true); setError(null); }} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" disabled={loading}>{loading && <Loader2 className="size-4 animate-spin" />}{isAr ? "تسجيل الدخول" : "Log in"}</Button>
        </form>
      ) : (
        <form onSubmit={onPhoneLogin} className="mt-5 flex flex-col gap-4">
          <PhoneField isAr={isAr} label={isAr ? "رقم الجوال" : "Mobile number"} required dialCode={dialCode} onDialCode={setDialCode} value={phone} onValue={setPhone} />
          {otpSent && (
            <Field label={isAr ? "رمز الدخول" : "Login code"} value={otp} onChange={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" required placeholder="••••••" hint={isAr ? "أرسلناه برسالة نصية" : "Sent to you by SMS"} />
          )}
          <RememberRow isAr={isAr} rememberMe={rememberMe} setRememberMe={setRememberMe} onForgot={() => { setForgot(true); setError(null); }} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {otpSent ? (isAr ? "دخول" : "Log in") : (isAr ? "أرسل رمز الدخول" : "Send login code")}
          </Button>
          {otpSent && (
            <button type="button" onClick={sendOtp} className="text-sm font-medium text-primary hover:underline">{isAr ? "إعادة إرسال الرمز" : "Resend code"}</button>
          )}
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isAr ? "ليس لديك حساب؟" : "No account?"}{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">{isAr ? "أنشئ حساباً" : "Create one"}</Link>
      </p>
    </AuthShell>
  );
}

function MethodTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Mail; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
        active ? "bg-background text-foreground shadow-e1" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-4" /> {label}
    </button>
  );
}

function RememberRow({ isAr, rememberMe, setRememberMe, onForgot }: { isAr: boolean; rememberMe: boolean; setRememberMe: (v: boolean) => void; onForgot: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="size-4 rounded border-input accent-primary" />
        {isAr ? "تذكّرني" : "Remember me"}
      </label>
      <button type="button" onClick={onForgot} className="text-sm font-medium text-primary hover:underline">{isAr ? "نسيت كلمة المرور؟" : "Forgot password?"}</button>
    </div>
  );
}
