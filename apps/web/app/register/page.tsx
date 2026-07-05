"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { Button, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field } from "@/components/field";
import { PhoneField, composePhone } from "@/components/phone-field";
import { GoogleButton } from "@/components/google-button";
import { AuthShell } from "@/components/auth-shell";

export default function RegisterPage() {
  const router = useRouter();
  const { register, requestOtp, loginWithGoogle } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";

  const [step, setStep] = React.useState<"details" | "verify">("details");
  const [form, setForm] = React.useState({
    fullName: "", dialCode: "+966", phone: "", email: "", password: "", terms: false,
  });
  // The cat named on the landing page — the account exists for their sake (R016).
  // The wizard consumes (and clears) the stored name right after this step.
  const [pendingCat, setPendingCat] = React.useState<string | null>(null);
  React.useEffect(() => {
    try { setPendingCat(sessionStorage.getItem("moraqat.pendingCatName")); } catch { /* ignore */ }
  }, []);
  const [otp, setOtp] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const phoneDigits = form.phone.replace(/\D/g, "");
  // Phone is optional now that OTP is off; include it only if a real number is given.
  const fullPhone = phoneDigits.length >= 8 ? composePhone(form.dialCode, form.phone) : undefined;
  // SMS OTP is only usable once a provider is wired. Until then, verify-by-SMS is
  // skipped so signups still work.
  const smsEnabled = process.env.NEXT_PUBLIC_SMS_ENABLED === "true";

  async function doRegister(withOtp?: string) {
    await register({
      fullName: form.fullName || undefined,
      email: form.email,
      password: form.password,
      ...(fullPhone ? { phone: fullPhone, dialCode: form.dialCode } : {}),
      acceptTerms: true,
      ...(withOtp ? { otp: withOtp } : {}),
    });
    // Straight into naming their cat — never a generic dashboard first (Stage 4).
    router.push("/portal/cats/new");
  }

  async function startVerification(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.terms) { setError(isAr ? "لازم توافق على الشروط وسياسة الخصوصية" : "Please accept the Terms & Privacy Policy"); return; }
    if (phoneDigits && phoneDigits.length < 8) { setError(isAr ? "رقم الجوال غير صحيح" : "Enter a valid mobile number"); return; }
    setLoading(true);
    try {
      if (!smsEnabled) {
        // No SMS provider — create the account directly (fewest steps, R002).
        await doRegister();
        return;
      }
      if (!fullPhone) { setError(isAr ? "أدخل رقم جوالك للتحقق" : "Enter your mobile to verify"); setLoading(false); return; }
      const { devCode } = await requestOtp(fullPhone, "REGISTER");
      setStep("verify");
      if (devCode) toast({ title: isAr ? "رمز التحقق (وضع التطوير)" : "Verification code (dev)", description: devCode });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  async function completeRegistration(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await doRegister(otp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle(idToken: string) {
    setError(null);
    try {
      await loginWithGoogle(idToken);
      router.push(pendingCat ? "/portal/cats/new" : "/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    }
  }

  if (step === "verify") {
    return (
      <AuthShell isAr={isAr} title={isAr ? "تأكيد رقم جوالك" : "Verify your mobile"} subtitle={isAr ? `أرسلنا رمزاً إلى ${fullPhone}` : `We sent a code to ${fullPhone}`}>
        <form onSubmit={completeRegistration} className="flex flex-col gap-4">
          <Field
            label={isAr ? "رمز التحقق" : "Verification code"}
            value={otp}
            onChange={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            required
            placeholder="••••••"
            hint={isAr ? "٦ أرقام وصلتك برسالة نصية" : "6 digits sent by SMS"}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" disabled={loading || otp.length < 4} className="mt-1">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {isAr ? "أنشئ الحساب" : "Create account"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={() => { setStep("details"); setError(null); }} className="text-muted-foreground hover:text-foreground">
              {isAr ? "تعديل البيانات" : "Edit details"}
            </button>
            <button type="button" onClick={() => startVerification(new Event("submit") as unknown as React.FormEvent)} className="font-medium text-primary hover:underline">
              {isAr ? "إعادة إرسال الرمز" : "Resend code"}
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      isAr={isAr}
      previewCatName={pendingCat}
      title={pendingCat ? (isAr ? `حساب لأجل ${pendingCat}` : `An account, for ${pendingCat}'s sake`) : (isAr ? "أنشئ حسابك" : "Create your account")}
      subtitle={
        pendingCat
          ? (isAr ? `خطوة وحدة، وبعدها نطبع هوية ${pendingCat}` : `One step, then we stamp ${pendingCat}'s ID`)
          : (isAr ? "انضم لعضوية مرقط — دقيقة وحدة وتخلص" : "Join Moracat — it takes a minute")
      }
    >
      <div className="mb-5">
        <GoogleButton isAr={isAr} onCredential={onGoogle} />
      </div>
      <Divider isAr={isAr} />

      <form onSubmit={startVerification} className="mt-5 flex flex-col gap-4">
        <Field label={isAr ? "الاسم الكامل" : "Full name"} value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} placeholder={isAr ? "مثلاً: سارة العتيبي" : "e.g. Sara Al-Otaibi"} autoComplete="name" />
        <PhoneField isAr={isAr} label={isAr ? "رقم الجوال (اختياري)" : "Mobile number (optional)"} dialCode={form.dialCode} onDialCode={(v) => setForm({ ...form, dialCode: v })} value={form.phone} onValue={(v) => setForm({ ...form, phone: v })} />
        <Field label={isAr ? "البريد الإلكتروني" : "Email"} type="email" required value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="you@example.com" autoComplete="email" />
        <Field label={isAr ? "كلمة المرور" : "Password"} type="password" required value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder={isAr ? "٨ أحرف على الأقل" : "At least 8 characters"} autoComplete="new-password" />

        <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.checked })} className="mt-0.5 size-4 rounded border-input accent-primary" />
          <span>
            {isAr ? "أوافق على " : "I agree to the "}
            <Link href="/legal/terms" className="font-medium text-primary hover:underline">{isAr ? "الشروط" : "Terms"}</Link>
            {isAr ? " و" : " & "}
            <Link href="/legal/privacy" className="font-medium text-primary hover:underline">{isAr ? "سياسة الخصوصية" : "Privacy Policy"}</Link>
          </span>
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" disabled={loading} className="mt-1">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {smsEnabled ? (isAr ? "تحقّق من الجوال وأكمل" : "Verify mobile & continue") : (isAr ? "إنشاء الحساب" : "Create account")}
          {!loading && <ArrowRight className="size-4 rtl:rotate-180" />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isAr ? "لديك حساب؟" : "Already have an account?"}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">{isAr ? "سجّل الدخول" : "Log in"}</Link>
      </p>
    </AuthShell>
  );
}

function Divider({ isAr }: { isAr: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{isAr ? "أو بالبريد والجوال" : "or with email & mobile"}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
