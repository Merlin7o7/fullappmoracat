"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { Button, IdBand, Seal, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { Field } from "@/components/field";
import { OtpBoxes } from "@/components/otp-boxes";
import { GoogleButton, googleEnabled } from "@/components/google-button";
import { useCaptureSource } from "@/lib/source";
import { readFirstTouch } from "@/lib/first-touch";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
export const DRAFT_KEY = "moraqat.draftCat";

type Sex = "FEMALE" | "MALE" | "UNKNOWN";
const AGES: { key: string; months: number | null; ar: string; en: string }[] = [
  { key: "kitten", months: 4, ar: "أقل من سنة", en: "Under a year" },
  { key: "young", months: 24, ar: "1–3 سنوات", en: "1–3 years" },
  { key: "adult", months: 66, ar: "4–8 سنوات", en: "4–8 years" },
  { key: "senior", months: 120, ar: "أكبر من 8", en: "Over 8" },
  { key: "unknown", months: null, ar: "ما أدري", en: "Not sure" },
];

/**
 * «4 inputs before the ceremony» (UX reassessment W8, R002).
 *
 *   1 · the cat's name   2 · sex   3 · age   4 · an email (+ the code it gets)
 *
 * No password, no phone, no city, no photo before the reveal — each of those
 * comes after, in the profile's "complete the file" list, once the member has
 * something to protect. The draft cat travels in sessionStorage to the issue
 * step, which creates it and plays the ceremony.
 */
export function StartFlow({ isAr }: { isAr: boolean }) {
  const router = useRouter();
  const { user, ready, adoptSession, loginWithGoogle } = useAuth();
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const [step, setStep] = React.useState<"cat" | "email" | "code">("cat");
  const [name, setName] = React.useState("");
  const [sex, setSex] = React.useState<Sex | "">("");
  const [age, setAge] = React.useState<string>("");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [devCode, setDevCode] = React.useState<string | null>(null);
  // Stand / campaign source (?src=) and an inviting member (?ref=) are kept.
  useCaptureSource();
  const [refCode, setRefCode] = React.useState<string | null>(null);
  React.useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("ref");
    if (r && /^[A-Za-z0-9-]{3,40}$/.test(r)) setRefCode(r);
  }, []);

  // A name typed on the homepage follows the visitor here (R117).
  React.useEffect(() => {
    try {
      const pending = sessionStorage.getItem("moraqat.pendingCatName");
      if (pending) setName((n) => n || pending);
    } catch {
      /* ignore */
    }
  }, []);

  const catReady = name.trim().length >= 1 && !!sex && !!age;
  const saveDraft = () => {
    const months = AGES.find((a) => a.key === age)?.months ?? null;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ name: name.trim(), gender: sex, ageMonths: months }));
      sessionStorage.removeItem("moraqat.pendingCatName");
    } catch {
      /* private mode: the issue step falls back to its own form */
    }
  };
  const toIssue = () => router.push("/portal/cats/new?from=start");

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE}/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error((json && (json.message as string)) || "failed") as Error & { code?: string; status?: number };
      err.code = json?.code;
      err.status = res.status;
      throw err;
    }
    return json as T;
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ sent: boolean; devCode?: string }>("/auth/email/start", { email: email.trim(), locale: isAr ? "ar" : "en" });
      setDevCode(r.devCode ?? null);
      setStep("code");
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(
        code === "OTP_RATE_LIMITED"
          ? t("انتظر دقيقة قبل طلب رمز جديد.", "Wait a minute before asking for another code.")
          : t("تأكد من البريد وحاول مرة ثانية.", "Check the email address and try again.")
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    if (value.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ user: never; accessToken: string; refreshToken: string }>("/auth/email/continue", {
        email: email.trim(),
        code: value,
        acceptTerms: true,
        locale: isAr ? "ar" : "en",
        firstTouch: readFirstTouch(),
        ...(refCode ? { ref: refCode } : {}),
      });
      adoptSession(r);
      toIssue();
    } catch (e) {
      const c = (e as { code?: string }).code;
      setError(
        c === "TOTP_REQUIRED"
          ? t("حسابك محمي بخطوتين — سجّل دخولك بكلمة المرور.", "Your account uses two-step sign-in — sign in with your password.")
          : t("الرمز غير صحيح أو انتهت صلاحيته.", "That code isn't right, or it has expired.")
      );
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  const progress = step === "cat" ? 1 : 2;

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      {/* The artifact being made, from the first second: a blank ID band. */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <IdBand kind={t("هوية مرقط", "Moracat ID")} serial="MRC-····-····" seal={<Seal label={t("تُصدر بعد قليل", "Issued in a moment")} />} />
        <div className="px-5 py-6">
          <p className="font-display text-4xl leading-tight">{name.trim() || t("اسم قطك", "Your cat's name")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {[sex === "FEMALE" ? t("أنثى", "Female") : sex === "MALE" ? t("ذكر", "Male") : null, AGES.find((a) => a.key === age)?.[isAr ? "ar" : "en"] ?? null]
              .filter(Boolean)
              .join(" · ") || t("خطوتين وتصير الهوية جاهزة", "Two steps and the ID is ready")}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t(`الخطوة ${progress} من 2`, `Step ${progress} of 2`)}
      </p>

      {step === "cat" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!catReady) return;
            saveDraft();
            if (user) toIssue();
            else setStep("email");
          }}
          className="space-y-5"
        >
          <Field label={t("اسم قطك", "Your cat's name")} required value={name} onChange={setName} autoFocus autoComplete="off" />

          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("ذكر أو أنثى؟", "Male or female?")}</legend>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["FEMALE", t("أنثى", "Female")],
                ["MALE", t("ذكر", "Male")],
                ["UNKNOWN", t("ما أدري", "Not sure")],
              ] as const).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={sex === v}
                  onClick={() => setSex(v)}
                  className={cn(
                    "h-12 rounded-md border text-sm font-medium transition-colors",
                    sex === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("كم عمره تقريباً؟", "Roughly how old?")}</legend>
            <div className="flex flex-wrap gap-2">
              {AGES.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  aria-pressed={age === a.key}
                  onClick={() => setAge(a.key)}
                  className={cn(
                    "h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                    age === a.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
                  )}
                >
                  {isAr ? a.ar : a.en}
                </button>
              ))}
            </div>
          </fieldset>

          <Button type="submit" size="lg" className="w-full" disabled={!catReady || !ready}>
            {user ? t("أصدر الهوية", "Issue the ID") : t("التالي", "Next")}
            <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
          </Button>
        </form>
      )}

      {step === "email" && (
        <div className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode();
            }}
            className="space-y-4"
          >
            <Field
              label={t("بريدك الإلكتروني", "Your email")}
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={setEmail}
              hint={t("نرسل لك رمزاً من 6 أرقام — بدون كلمة مرور.", "We'll send a 6-digit code — no password.")}
            />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}>
              <Mail className="size-4" aria-hidden /> {t("أرسل الرمز", "Send the code")}
            </Button>
          </form>
          {googleEnabled && (
          <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("أو", "or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <GoogleButton
            isAr={isAr}
            onCredential={async (idToken) => {
              try {
                await loginWithGoogle(idToken, true);
                toIssue();
              } catch {
                setError(t("تعذّر الدخول بحساب Google.", "Couldn't continue with Google."));
              }
            }}
          />
          </>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("بالمتابعة أنت توافق على ", "By continuing you agree to the ")}
            <Link href="/legal/terms" className="underline underline-offset-4">{t("الشروط", "Terms")}</Link>
            {t(" و", " and ")}
            <Link href="/legal/privacy" className="underline underline-offset-4">{t("سياسة الخصوصية", "Privacy Policy")}</Link>.
          </p>
          <button type="button" onClick={() => setStep("cat")} className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:underline">
            {t("رجوع", "Back")}
          </button>
        </div>
      )}

      {step === "code" && (
        <div className="space-y-4">
          <p className="text-sm">
            {t("أرسلنا رمزاً إلى ", "We sent a code to ")}
            <span dir="ltr" className="font-medium">{email.trim()}</span>
          </p>
          <OtpBoxes value={code} onChange={setCode} onComplete={(v) => void verify(v)} disabled={busy} isAr={isAr} autoFocus />
          {devCode && <p className="text-xs text-muted-foreground" dir="ltr">dev code: {devCode}</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="flex-1" loading={busy} disabled={code.length !== 6} onClick={() => void verify(code)}>
              {t("تأكيد وإصدار الهوية", "Confirm and issue the ID")}
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <button type="button" className="min-h-11 text-primary hover:underline" disabled={busy} onClick={() => void sendCode()}>
              {t("أرسل الرمز مرة ثانية", "Send it again")}
            </button>
            <button type="button" className="min-h-11 text-muted-foreground hover:underline" onClick={() => { setStep("email"); setCode(""); }}>
              {t("غيّر البريد", "Change email")}
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        {t("عندك حساب؟ ", "Already a member? ")}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">{t("سجّل دخولك", "Sign in")}</Link>
      </p>
    </div>
  );
}
