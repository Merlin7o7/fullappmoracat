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
import { ApiError } from "@/lib/http";

// Draft persistence (R117 — never lose entered data). Name, phone and email
// only — NEVER the password, never the terms tick.
const DRAFT_KEY = "moraqat.signupDraft";
type SignupDraft = { fullName?: string; dialCode?: string; phone?: string; email?: string };

function clearSignupDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

export default function RegisterPage() {
  const router = useRouter();
  const { register, requestOtp, loginWithGoogle } = useAuth();
  // Referral code from ?ref= — read from the URL without useSearchParams so the
  // page needn't be wrapped in a Suspense boundary at build time.
  const [refCode, setRefCode] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("ref");
    if (r) setRefCode(r);
  }, []);
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

  // Restore a saved draft on mount — but never clobber anything already typed.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as SignupDraft;
      setForm((f) => ({
        ...f,
        fullName: f.fullName || draft.fullName || "",
        dialCode: draft.dialCode || f.dialCode,
        phone: f.phone || draft.phone || "",
        email: f.email || draft.email || "",
      }));
    } catch { /* ignore */ }
  }, []);

  // Persist the draft as they type (debounced) so a refresh, crash or wrong
  // turn never costs them their details (R117).
  const { fullName: draftName, dialCode: draftDial, phone: draftPhone, email: draftEmail } = form;
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      if (!draftName && !draftPhone && !draftEmail) return;
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ fullName: draftName, dialCode: draftDial, phone: draftPhone, email: draftEmail } satisfies SignupDraft)
        );
      } catch { /* ignore */ }
    }, 400);
    return () => window.clearTimeout(t);
  }, [draftName, draftDial, draftPhone, draftEmail]);

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
      ...(refCode ? { ref: refCode } : {}),
    });
    // Account created — the draft has done its job.
    clearSignupDraft();
    // Verify email by OTP first; then straight into naming their cat.
    router.push(`/verify-email?next=${encodeURIComponent("/portal/cats/new")}`);
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
      setError(registerErrorMessage(err, isAr));
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
      setError(registerErrorMessage(err, isAr));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle(idToken: string) {
    setError(null);
    try {
      await loginWithGoogle(idToken);
      clearSignupDraft();
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
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
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
      <Divider isAr={isAr} withPhone={smsEnabled} />

      <form onSubmit={startVerification} className="mt-5 flex flex-col gap-4">
        <Field label={isAr ? "الاسم الكامل" : "Full name"} value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} placeholder={isAr ? "مثلاً: سارة العتيبي" : "e.g. Sara Al-Otaibi"} autoComplete="name" />
        {/* The phone field only appears when SMS verification is live — asking
            for a number we'd silently discard breaks trust (R086/R113). */}
        {smsEnabled && (
          <PhoneField isAr={isAr} label={isAr ? "رقم الجوال" : "Mobile number"} required dialCode={form.dialCode} onDialCode={(v) => setForm({ ...form, dialCode: v })} value={form.phone} onValue={(v) => setForm({ ...form, phone: v })} />
        )}
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

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
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

function Divider({ isAr, withPhone }: { isAr: boolean; withPhone: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">
        {withPhone ? (isAr ? "أو بالبريد والجوال" : "or with email & mobile") : (isAr ? "أو بالبريد الإلكتروني" : "or with email")}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/**
 * A failed signup must never blame the member (R084/R113): a network blip says
 * so plainly and reassures them the draft is safe; a server rejection surfaces
 * the API's own (already localized) message.
 */
function registerErrorMessage(err: unknown, isAr: boolean): string {
  if (err instanceof ApiError && (err.kind === "network" || err.kind === "timeout")) {
    return isAr
      ? "ما قدرنا نوصل للخادم — بياناتك محفوظة عندنا، حاول مرة ثانية."
      : "We couldn't reach the server — your details are kept, try again.";
  }
  if (err instanceof Error && err.message) return err.message;
  return isAr ? "تعذّر إنشاء الحساب — حاول مرة ثانية بعد لحظات." : "We couldn't create your account — try again in a moment.";
}
