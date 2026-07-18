"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, ShieldCheck, Check } from "lucide-react";
import { Button, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field } from "@/components/field";
import { PhoneField, composePhone } from "@/components/phone-field";
import { GoogleButton, googleEnabled } from "@/components/google-button";
import { AuthShell } from "@/components/auth-shell";
import { OtpBoxes } from "@/components/otp-boxes";
import { ApiError } from "@/lib/http";
import { friendlyError } from "@/lib/errors";

// Draft persistence (R117 — never lose entered data). Name, phone and email
// only — NEVER the password, never the terms tick.
const DRAFT_KEY = "moraqat.signupDraft";
type SignupDraft = { fullName?: string; dialCode?: string; phone?: string; email?: string };

function clearSignupDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

/** The DTO's password rules (see apps/api/src/auth/password-policy.ts) — the
 *  checklist ticks green as the member types, so WEAK_PASSWORD never surprises. */
const PASSWORD_CHECKS = [
  { id: "minLength", ar: "٨ أحرف على الأقل", en: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "letter", ar: "حرف واحد على الأقل", en: "At least one letter", test: (p: string) => /[A-Za-z]/.test(p) },
  { id: "number", ar: "رقم واحد على الأقل", en: "At least one number", test: (p: string) => /\d/.test(p) },
] as const;

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

  // The one clear CTA (R005/R086): when a cat is already waiting, the button
  // names where this leads — straight to their ID, no verification wall.
  const continueLabel = pendingCat
    ? (isAr ? `متابعة لهوية ${pendingCat}` : `Continue to ${pendingCat}'s ID`)
    : (isAr ? "إنشاء الحساب" : "Create account");

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
    // Straight to the Cat ID (north star: holding it in under two minutes).
    // Email verification runs in parallel — a quiet portal banner invites it;
    // it gates only the community-publish action, never the ID itself.
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
      setOtp("");
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
      setError(friendlyError(err, isAr).message);
    }
  }

  if (step === "verify") {
    return (
      <AuthShell isAr={isAr} title={isAr ? "تأكيد رقم جوالك" : "Verify your mobile"} subtitle={isAr ? `أرسلنا رمزاً إلى ${fullPhone}` : `We sent a code to ${fullPhone}`}>
        <form onSubmit={completeRegistration} className="flex flex-col items-center gap-4">
          <OtpBoxes
            value={otp}
            onChange={setOtp}
            disabled={loading}
            isAr={isAr}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">{isAr ? "٦ أرقام وصلتك برسالة نصية" : "6 digits sent by SMS"}</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" disabled={loading || otp.length !== 6} className="mt-1 w-full">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {pendingCat ? continueLabel : isAr ? "أنشئ الحساب" : "Create account"}
          </Button>
          <div className="flex w-full items-center justify-between text-sm">
            <button type="button" onClick={() => { setStep("details"); setError(null); }} className="min-h-[44px] text-muted-foreground hover:text-foreground">
              {isAr ? "تعديل البيانات" : "Edit details"}
            </button>
            <button type="button" onClick={() => startVerification(new Event("submit") as unknown as React.FormEvent)} className="min-h-[44px] font-medium text-primary hover:underline">
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
      {/* On phones the brand aside is folded away (hidden lg:flex) — this light
          strip keeps the cat present as the reason for the form (R009/R016). */}
      {pendingCat && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-3 lg:hidden">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <span aria-hidden className="font-display text-base font-bold">{pendingCat.trim().charAt(0)}</span>
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{isAr ? `هوية ${pendingCat} جاهزة تنطبع` : `${pendingCat}'s ID is ready to be stamped`}</p>
            <p className="font-mono text-xs text-muted-foreground" dir="ltr">MRC-····-····</p>
          </div>
        </div>
      )}

      {googleEnabled && (
        <>
          <div className="mb-5">
            <GoogleButton isAr={isAr} onCredential={onGoogle} />
          </div>
          <Divider isAr={isAr} withPhone={smsEnabled} />
        </>
      )}

      <form onSubmit={startVerification} className="mt-5 flex flex-col gap-4">
        <Field label={isAr ? "الاسم الكامل" : "Full name"} value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} placeholder={isAr ? "مثلاً: سارة العتيبي" : "e.g. Sara Al-Otaibi"} autoComplete="name" />
        {/* The phone field only appears when SMS verification is live — asking
            for a number we'd silently discard breaks trust (R086/R113). */}
        {smsEnabled && (
          <PhoneField isAr={isAr} label={isAr ? "رقم الجوال" : "Mobile number"} required dialCode={form.dialCode} onDialCode={(v) => setForm({ ...form, dialCode: v })} value={form.phone} onValue={(v) => setForm({ ...form, phone: v })} />
        )}
        <Field label={isAr ? "البريد الإلكتروني" : "Email"} type="email" required value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="you@example.com" autoComplete="email" />
        <div className="flex flex-col gap-1.5">
          <Field label={isAr ? "كلمة المرور" : "Password"} type="password" required value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder={isAr ? "٨ أحرف على الأقل" : "At least 8 characters"} autoComplete="new-password" />
          <PasswordChecklist isAr={isAr} password={form.password} />
        </div>

        <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.checked })} className="mt-0.5 size-4 rounded border-input accent-primary" />
          <span>
            {isAr ? "أوافق على " : "I agree to the "}
            {/* New tab (noopener): reading the terms must never toggle the
                checkbox or cost the member the form they just filled (R117). */}
            <Link href="/legal/terms" target="_blank" rel="noopener" className="font-medium text-primary hover:underline">{isAr ? "الشروط" : "Terms"}</Link>
            {isAr ? " و" : " & "}
            <Link href="/legal/privacy" target="_blank" rel="noopener" className="font-medium text-primary hover:underline">{isAr ? "سياسة الخصوصية" : "Privacy Policy"}</Link>
          </span>
        </label>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" disabled={loading} className="mt-1">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {smsEnabled ? (isAr ? "تحقّق من الجوال وأكمل" : "Verify mobile & continue") : continueLabel}
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

/**
 * The live password checklist — every DTO rule visible up front, ticking green
 * as it's met, so WEAK_PASSWORD can never arrive as a surprise (R112/R115).
 * A real check mark carries the meaning, never colour alone (R093).
 */
function PasswordChecklist({ isAr, password }: { isAr: boolean; password: string }) {
  if (!password) return null;
  return (
    <ul className="flex flex-col gap-1" aria-label={isAr ? "متطلبات كلمة المرور" : "Password requirements"}>
      {PASSWORD_CHECKS.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.id} className={cn("flex items-center gap-1.5 text-xs transition-colors", ok ? "text-success" : "text-muted-foreground")}>
            {ok ? (
              <Check className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <span aria-hidden className="grid size-3.5 shrink-0 place-items-center"><span className="size-1 rounded-full bg-current" /></span>
            )}
            {isAr ? rule.ar : rule.en}
            <span className="sr-only">{ok ? (isAr ? "— تحقق" : "— met") : (isAr ? "— لم يتحقق بعد" : "— not yet met")}</span>
          </li>
        );
      })}
    </ul>
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
 * A failed signup must never blame the member (R084/R113). Every error renders
 * through friendlyError (bilingual, recovery-oriented); a network blip
 * additionally reassures them the saved draft is safe (R117).
 */
function registerErrorMessage(err: unknown, isAr: boolean): string {
  const fe = friendlyError(err, isAr);
  if (err instanceof ApiError && (err.kind === "network" || err.kind === "timeout")) {
    return isAr
      ? `${fe.message} بياناتك محفوظة عندنا.`
      : `${fe.message} Your details are kept safe here.`;
  }
  return fe.message;
}
