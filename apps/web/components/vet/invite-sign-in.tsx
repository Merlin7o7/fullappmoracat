"use client";

/**
 * Signing in to accept a clinic invitation — for someone who ALREADY has a
 * Moracat account with the invited email.
 *
 * The invitation preview reports how that account can actually sign in
 * (`signIn.password`, `signIn.google`). Offering a password box to a member who
 * joined with Google strands them at the door (seen in production 2026-09-16),
 * so this renders only the doors that open (R084 errors are recoveries, R002
 * effort is the enemy):
 *
 *   • Google account      → "Continue with Google" first.
 *   • Has a password      → the password form (+ two-factor when asked).
 *   • No password at all  → "Email me a link to set a password", with a clear
 *                           note to come back to the invitation afterwards.
 *
 * The caller decides what happens once signed in (claim, accept) via
 * `onSignedIn`; this component only establishes the session.
 */

import * as React from "react";
import { KeyRound, MailCheck } from "lucide-react";
import { Button, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { friendlyError } from "@/lib/errors";
import { GoogleButton, googleEnabled } from "@/components/google-button";
import type { InviteSignInMethods } from "@/lib/vet-registration";

interface Props {
  isAr: boolean;
  email: string;
  methods: InviteSignInMethods;
  /** Runs after a session exists (password or Google). May throw to show an error. */
  onSignedIn: () => Promise<void> | void;
  /** Guard run before any sign-in attempt (e.g. a required checkbox). Return false to stop. */
  beforeSignIn?: () => boolean;
  submitLabel: { ar: string; en: string };
  className?: string;
}

export function InviteSignIn({ isAr, email, methods, onSignedIn, beforeSignIn, submitLabel, className }: Props) {
  const { login, loginWithGoogle, forgotPassword, logout } = useAuth();
  const [password, setPassword] = React.useState("");
  const [totp, setTotp] = React.useState("");
  const [needsTotp, setNeedsTotp] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<{ title: string; message: string } | null>(null);
  const [linkSent, setLinkSent] = React.useState(false);

  // Google is the account's own door when it was created with Google — or the
  // only door besides a reset link when there is no password.
  const showGoogle = googleEnabled && (methods.google || !methods.password);
  const showPassword = methods.password;

  async function afterSession() {
    try {
      await onSignedIn();
    } catch (err) {
      setError(friendlyError(err, isAr));
    }
  }

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password || (beforeSignIn && !beforeSignIn())) return;
    setBusy(true);
    setError(null);
    try {
      await login(email, password, { totp: totp || undefined, rememberMe: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "TOTP_REQUIRED") setNeedsTotp(true);
      setError(friendlyError(err, isAr));
      setBusy(false);
      return;
    }
    await afterSession();
    setBusy(false);
  }

  async function onGoogle(idToken: string) {
    if (beforeSignIn && !beforeSignIn()) return;
    setBusy(true);
    setError(null);
    try {
      await loginWithGoogle(idToken, true);
    } catch (err) {
      setError(friendlyError(err, isAr));
      setBusy(false);
      return;
    }
    // Google may hand back a DIFFERENT Google account than the invited one.
    // The session belongs to whoever Google returned, so check before acting.
    const signedIn = readSessionEmail();
    if (signedIn && signedIn !== email.toLowerCase()) {
      await logout();
      setError(
        isAr
          ? {
              title: "حساب Google مختلف",
              message: `الدعوة مرسلة إلى ${email}. اختر هذا الحساب في نافذة Google.`,
            }
          : {
              title: "Different Google account",
              message: `The invitation was sent to ${email}. Choose that account in the Google window.`,
            }
      );
      setBusy(false);
      return;
    }
    await afterSession();
    setBusy(false);
  }

  async function sendSetPasswordLink() {
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email);
      setLinkSent(true);
    } catch (err) {
      setError(friendlyError(err, isAr));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden>
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold">
            {isAr ? "لديك حساب في مرقط بهذا البريد" : "You already have a Moracat account"}
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {methods.google && !methods.password
              ? isAr
                ? "أنشأته بحساب Google — ادخل به للمتابعة، لا تحتاج كلمة مرور."
                : "You created it with Google — continue with Google, no password needed."
              : isAr
                ? "ادخل به للمتابعة — لا حاجة لحساب جديد."
                : "Sign in with it to continue — no new account needed."}
          </p>
          <p className="mt-1 text-xs font-medium" dir="ltr">
            {email}
          </p>
        </div>
      </div>

      {showGoogle && (
        <div className="flex flex-col items-center gap-2">
          <GoogleButton isAr={isAr} onCredential={(t) => void onGoogle(t)} />
          {showPassword && (
            <p className="text-xs text-muted-foreground">{isAr ? "أو بكلمة المرور" : "or with your password"}</p>
          )}
        </div>
      )}

      {showPassword && (
        <form onSubmit={onPassword} noValidate className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{isAr ? "كلمة المرور" : "Password"}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              dir="ltr"
              required
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          {needsTotp && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{isAr ? "رمز المصادقة الثنائية" : "Two-factor code"}</span>
              <input
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                required
                className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          )}
          <Button type="submit" size="lg" loading={busy} disabled={!password} className="w-full">
            {isAr ? submitLabel.ar : submitLabel.en}
          </Button>
        </form>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">{error.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{error.message}</p>
        </div>
      )}

      {/* The fallback that always works: set (or reset) a password by email. */}
      {linkSent ? (
        <div role="status" className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-xs leading-relaxed">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <span>
            {isAr
              ? `أرسلنا إلى ${email} رابطاً لتعيين كلمة مرور. بعد تعيينها افتح رابط الدعوة هذا مرة أخرى وادخل بها.`
              : `We've emailed ${email} a link to set a password. Once it's set, open this invitation link again and sign in.`}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void sendSetPasswordLink()}
          disabled={busy}
          className="mx-auto inline-flex min-h-[44px] items-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
        >
          {showPassword
            ? isAr
              ? "نسيت كلمة المرور؟ أرسل لي رابطاً"
              : "Forgot your password? Email me a link"
            : isAr
              ? "أفضّل كلمة مرور — أرسل لي رابطاً لتعيينها"
              : "Prefer a password? Email me a link to set one"}
        </button>
      )}
    </div>
  );
}

/** The email of the session just persisted by useAuth (read synchronously). */
function readSessionEmail(): string | null {
  try {
    const raw = localStorage.getItem("moraqat.auth");
    const parsed = raw ? (JSON.parse(raw) as { user?: { email?: string } }) : null;
    return parsed?.user?.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}
