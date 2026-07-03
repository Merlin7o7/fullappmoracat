"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field } from "@/components/field";
import { AuthShell } from "@/components/auth-shell";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [form, setForm] = React.useState({ email: "", password: "", totp: "" });
  const [needsTotp, setNeedsTotp] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(form.email, form.password, form.totp || undefined);
      router.push("/portal");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      if (/2fa/i.test(msg)) setNeedsTotp(true);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell isAr={isAr} title={isAr ? "مرحباً بعودتك" : "Welcome back"} subtitle={isAr ? "سجّل الدخول لإدارة اشتراكك" : "Log in to manage your subscription"}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label={isAr ? "البريد الإلكتروني" : "Email"} type="email" required
          value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="you@example.com" />
        <Field label={isAr ? "كلمة المرور" : "Password"} type="password" required
          value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="••••••••" />
        {needsTotp && (
          <Field label={isAr ? "رمز التحقق (2FA)" : "2FA code"} type="text"
            value={form.totp} onChange={(v) => setForm({ ...form, totp: v })} placeholder="123456" />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" disabled={loading} className="mt-2">
          {loading && <Loader2 className="size-4 animate-spin" />}
          {isAr ? "تسجيل الدخول" : "Log in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isAr ? "ليس لديك حساب؟" : "No account?"}{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          {isAr ? "أنشئ حساباً" : "Create one"}
        </Link>
      </p>
    </AuthShell>
  );
}
