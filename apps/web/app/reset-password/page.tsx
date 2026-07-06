"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field } from "@/components/field";
import { AuthShell } from "@/components/auth-shell";

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetPasswordInner />
    </React.Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const { resetPassword } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError(isAr ? "كلمتا المرور غير متطابقتين" : "Passwords don't match"); return; }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      toast({ title: isAr ? "تم تحديث كلمة المرور" : "Password updated", variant: "success" });
      setTimeout(() => router.push("/login"), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally { setLoading(false); }
  }

  if (!token) {
    return (
      <AuthShell isAr={isAr} title={isAr ? "رابط غير صالح" : "Invalid link"} subtitle={isAr ? "رابط الاستعادة ناقص أو منتهي" : "This reset link is missing or expired"}>
        <Link href="/login"><Button size="lg" className="w-full">{isAr ? "الرجوع لتسجيل الدخول" : "Back to login"}</Button></Link>
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
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" disabled={loading}>{loading && <Loader2 className="size-4 animate-spin" />}{isAr ? "تحديث كلمة المرور" : "Update password"}</Button>
      </form>
    </AuthShell>
  );
}
