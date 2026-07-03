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

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [form, setForm] = React.useState({ firstName: "", lastName: "", email: "", password: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
      router.push("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell isAr={isAr} title={isAr ? "أنشئ حسابك" : "Create your account"} subtitle={isAr ? "ابدأ رحلة العناية بقطك" : "Start caring for your cat the smart way"}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={isAr ? "الاسم الأول" : "First name"} value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
          <Field label={isAr ? "اسم العائلة" : "Last name"} value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
        </div>
        <Field label={isAr ? "البريد الإلكتروني" : "Email"} type="email" required value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="you@example.com" />
        <Field label={isAr ? "كلمة المرور" : "Password"} type="password" required value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder={isAr ? "٨ أحرف على الأقل" : "At least 8 characters"} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" disabled={loading} className="mt-2">
          {loading && <Loader2 className="size-4 animate-spin" />}
          {isAr ? "إنشاء الحساب" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isAr ? "لديك حساب؟" : "Already have an account?"}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {isAr ? "سجّل الدخول" : "Log in"}
        </Link>
      </p>
    </AuthShell>
  );
}
