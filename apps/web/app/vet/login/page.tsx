"use client";

/**
 * Staff sign-in (MRC-VET-001 §02).
 *
 * Every staff member has their own account — non-negotiable, because this
 * portal shows medical data and applies financial benefits, and both must be
 * attributable to a person rather than a shared "reception" login. The design's
 * job is to make an individual account *cheaper* than sharing one.
 *
 * Second act: choosing the clinic. The same vet may be a VET at one clinic and
 * an OWNER at their own, and every API call carries the clinic it speaks for —
 * so the choice is made deliberately here, never guessed at silently. One
 * membership skips the step entirely.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, Loader2, LogOut, Stethoscope } from "lucide-react";
import { Button, Card, cn, useToast } from "@moraqat/ui";
import { VET_ROLE_LABELS } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { ApiError } from "@/lib/http";
import { Field } from "@/components/field";
import {
  rememberVetOrg,
  vetFriendlyError,
  vetOrgName,
  type VetAuthContext,
  type VetMembership,
} from "@/lib/vet-api";

export default function VetLoginPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const { toast } = useToast();
  const { login, authedFetch, user, ready, logout } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [totp, setTotp] = React.useState("");
  const [needsTotp, setNeedsTotp] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<{ title: string; message: string } | null>(null);

  const [memberships, setMemberships] = React.useState<VetMembership[] | null>(null);
  const [resolving, setResolving] = React.useState(false);

  /** Only ever an internal path — never an open redirect. */
  const destination = React.useCallback(() => {
    if (typeof window === "undefined") return "/vet";
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/vet";
  }, []);

  const resolveMemberships = React.useCallback(async () => {
    setResolving(true);
    setError(null);
    try {
      const ctx = await authedFetch<VetAuthContext>("/vet/auth/context", { method: "POST", body: "{}" });
      const list = ctx?.memberships ?? [];
      setMemberships(list);
      // One clinic is not a decision — don't stage a screen to confirm it.
      const usable = list.filter((m) => m.status === "ACTIVE");
      const only = usable.length === 1 ? usable[0] : undefined;
      if (only) {
        rememberVetOrg(only.orgId);
        router.replace(destination());
      }
    } catch (err) {
      setMemberships([]);
      setError(vetFriendlyError(err, isAr));
    } finally {
      setResolving(false);
    }
  }, [authedFetch, destination, isAr, router]);

  // Someone already signed in who lands here goes straight to clinic selection.
  React.useEffect(() => {
    if (!ready || !user || memberships !== null || resolving) return;
    void resolveMemberships();
  }, [ready, user, memberships, resolving, resolveMemberships]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password, { totp: totp || undefined, rememberMe: true });
      await resolveMemberships();
    } catch (err) {
      if (err instanceof ApiError && err.code === "TOTP_REQUIRED") setNeedsTotp(true);
      setError(vetFriendlyError(err, isAr));
    } finally {
      setBusy(false);
    }
  }

  function chooseOrg(m: VetMembership) {
    rememberVetOrg(m.orgId);
    toast({
      title: isAr ? `أهلاً بك في ${vetOrgName(m, true)}` : `Welcome to ${vetOrgName(m, false)}`,
      description: VET_ROLE_LABELS[m.role][isAr ? "ar" : "en"],
      variant: "success",
    });
    router.replace(destination());
  }

  /* ── Act two: which clinic? ─────────────────────────────────────────────── */
  if (user && memberships !== null) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-10">
        {memberships.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-info/12 text-info" aria-hidden>
              <Building2 className="size-5" />
            </span>
            <h1 className="font-display text-lg font-semibold">
              {isAr ? "هذا الحساب ليس ضمن فريق عيادة" : "This account isn't on a clinic team"}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isAr
                ? "اطلب من مدير عيادتك دعوتك — تأخذ عشرين ثانية ويصلك رابط على بريدك. أو قدّم طلب انضمام عيادتك إلى شبكة مرقط."
                : "Ask your clinic manager to invite you — it takes twenty seconds and a link arrives by email. Or apply to bring your clinic into the Moracat network."}
            </p>
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error.message}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button size="sm" onClick={() => router.push("/vet/apply")}>
                {isAr ? "قدّم طلب عيادة" : "Apply as a clinic"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void logout();
                  setMemberships(null);
                }}
              >
                <LogOut className="size-4" aria-hidden />
                {isAr ? "دخول بحساب آخر" : "Use another account"}
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div>
              <h1 className="font-display text-xl font-semibold">
                {isAr ? "أي عيادة تعمل باسمها الآن؟" : "Which clinic are you working for?"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isAr
                  ? "كل ما تفعله يُسجَّل باسم هذه العيادة. تقدر تبدّلها في أي وقت من الأعلى."
                  : "Everything you do is recorded for this clinic. You can switch at any time from the top bar."}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {memberships.map((m) => {
                const paused = m.status !== "ACTIVE";
                return (
                  <button
                    key={m.orgId}
                    type="button"
                    disabled={paused}
                    onClick={() => chooseOrg(m)}
                    className={cn(
                      "flex min-h-[56px] items-center gap-3 rounded-2xl border px-4 py-3 text-start transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      paused
                        ? "cursor-not-allowed border-border bg-muted/40 opacity-70"
                        : "border-border bg-card hover:border-primary/40 hover:bg-muted",
                    )}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden>
                      <Stethoscope className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{vetOrgName(m, isAr)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {VET_ROLE_LABELS[m.role][isAr ? "ar" : "en"]}
                        {m.branches.length > 1 &&
                          ` · ${m.branches.length} ${isAr ? "فروع" : "branches"}`}
                        {paused && ` · ${isAr ? "الوصول موقوف" : "access paused"}`}
                      </span>
                    </span>
                    {!paused && <Check className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                void logout();
                setMemberships(null);
              }}
              className="mx-auto inline-flex min-h-[44px] items-center gap-2 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <LogOut className="size-3.5" aria-hidden />
              {isAr ? "دخول بحساب آخر" : "Use another account"}
            </button>
          </>
        )}
      </div>
    );
  }

  if (user && resolving) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {isAr ? "نجهّز عياداتك…" : "Finding your clinics…"}
        </p>
      </div>
    );
  }

  /* ── Act one: sign in ───────────────────────────────────────────────────── */
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-10">
      <div>
        <h1 className="font-display text-2xl font-semibold leading-tight">
          {isAr ? "دخول فريق العيادة" : "Clinic team sign-in"}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "لكل زميل حساب خاص به — لأن كل إجراء طبي ومالي هنا يُنسب لشخص، لا لجهاز. على الكاونتر المشترك يكفي رمزك السري للتبديل خلال ثانيتين."
            : "Every colleague signs in as themselves — because every clinical and financial action here is attributed to a person, not a device. At a shared counter, your PIN switches identity in two seconds."}
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field
            label={isAr ? "البريد الإلكتروني" : "Email"}
            value={email}
            onChange={setEmail}
            type="email"
            autoComplete="email"
            required
            autoFocus
          />
          <Field
            label={isAr ? "كلمة المرور" : "Password"}
            value={password}
            onChange={setPassword}
            type="password"
            autoComplete="current-password"
            required
          />
          {needsTotp && (
            <Field
              label={isAr ? "رمز المصادقة الثنائية" : "Two-factor code"}
              value={totp}
              onChange={(v) => setTotp(v.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              hint={
                isAr
                  ? "الأدوار الإدارية تتطلب المصادقة الثنائية — بيانات المرضى تستحقها."
                  : "Privileged roles require two-factor sign-in — patient data earns it."
              }
              required
            />
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5">
              <p className="text-sm font-medium text-destructive">{error.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{error.message}</p>
            </div>
          )}

          <Button type="submit" size="lg" loading={busy} className="w-full">
            {isAr ? "ادخل إلى العيادة" : "Sign in to the clinic"}
          </Button>
        </form>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <Link
          href="/login"
          className="inline-flex min-h-[44px] items-center underline-offset-4 hover:text-foreground hover:underline"
        >
          {isAr ? "نسيت كلمة المرور؟" : "Forgot your password?"}
        </Link>
        <Link
          href="/vet/apply"
          className="inline-flex min-h-[44px] items-center font-medium text-primary underline-offset-4 hover:underline"
        >
          {isAr ? "عيادتك ليست شريكة بعد؟" : "Clinic not a partner yet?"}
        </Link>
      </div>
    </div>
  );
}
