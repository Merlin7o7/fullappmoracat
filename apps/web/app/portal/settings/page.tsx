"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Lock, ShieldCheck, Loader2, Check } from "lucide-react";
import { Card, Badge, Button, Skeleton } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field } from "@/components/field";

interface Profile {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string;
  locale: string;
  twoFactorEnabled: boolean;
}

export default function SettingsPage() {
  const { authedFetch, user, logout } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => authedFetch<Profile>("/account/profile"),
    enabled: !!user,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{isAr ? "الإعدادات" : "Settings"}</h1>
        <p className="text-sm text-muted-foreground">{isAr ? "الملف الشخصي والأمان" : "Profile and security"}</p>
      </div>

      {isLoading || !profile ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <ProfileSection isAr={isAr} profile={profile} authedFetch={authedFetch} onSaved={() => qc.invalidateQueries({ queryKey: ["profile"] })} />
          <PasswordSection isAr={isAr} authedFetch={authedFetch} onChanged={() => logout()} />
          <TwoFactorSection isAr={isAr} enabled={profile.twoFactorEnabled} authedFetch={authedFetch} onChanged={() => qc.invalidateQueries({ queryKey: ["profile"] })} />
        </>
      )}
    </div>
  );
}

function SectionCard({ icon: Icon, title, desc, children }: { icon: typeof User; title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
        <div>
          <h2 className="font-display font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

function ProfileSection({ isAr, profile, authedFetch, onSaved }: {
  isAr: boolean; profile: Profile; authedFetch: ReturnType<typeof useAuth>["authedFetch"]; onSaved: () => void;
}) {
  const [f, setF] = React.useState({ firstName: profile.firstName ?? "", lastName: profile.lastName ?? "", phone: profile.phone ?? "" });
  const [saved, setSaved] = React.useState(false);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => authedFetch("/account/profile", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { onSaved(); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });
  return (
    <SectionCard icon={User} title={isAr ? "الملف الشخصي" : "Profile"} desc={profile.email}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(f); }} className="grid gap-4 sm:grid-cols-2">
        <Field label={isAr ? "الاسم الأول" : "First name"} value={f.firstName} onChange={(v) => setF({ ...f, firstName: v })} />
        <Field label={isAr ? "اسم العائلة" : "Last name"} value={f.lastName} onChange={(v) => setF({ ...f, lastName: v })} />
        <Field label={isAr ? "الجوال" : "Phone"} value={f.phone} onChange={(v) => setF({ ...f, phone: v })} placeholder="+9665..." className="sm:col-span-2" />
        {save.error && <p className="text-sm text-destructive sm:col-span-2">{save.error.message}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
            {saved ? (isAr ? "تم الحفظ" : "Saved") : (isAr ? "حفظ" : "Save changes")}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

function PasswordSection({ isAr, authedFetch, onChanged }: {
  isAr: boolean; authedFetch: ReturnType<typeof useAuth>["authedFetch"]; onChanged: () => void;
}) {
  const [f, setF] = React.useState({ currentPassword: "", newPassword: "" });
  const change = useMutation({
    mutationFn: (body: Record<string, unknown>) => authedFetch("/account/change-password", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: onChanged,
  });
  return (
    <SectionCard icon={Lock} title={isAr ? "كلمة المرور" : "Password"} desc={isAr ? "تغيير كلمة المرور يسجّل خروجك من الأجهزة الأخرى" : "Changing your password logs out other devices"}>
      <form onSubmit={(e) => { e.preventDefault(); change.mutate(f); }} className="grid gap-4">
        <Field label={isAr ? "كلمة المرور الحالية" : "Current password"} type="password" required value={f.currentPassword} onChange={(v) => setF({ ...f, currentPassword: v })} />
        <Field label={isAr ? "كلمة المرور الجديدة" : "New password"} type="password" required value={f.newPassword} onChange={(v) => setF({ ...f, newPassword: v })} />
        {change.error && <p className="text-sm text-destructive">{change.error.message}</p>}
        <Button type="submit" variant="outline" disabled={change.isPending} className="w-fit">
          {change.isPending && <Loader2 className="size-4 animate-spin" />}{isAr ? "تحديث كلمة المرور" : "Update password"}
        </Button>
      </form>
    </SectionCard>
  );
}

function TwoFactorSection({ isAr, enabled, authedFetch, onChanged }: {
  isAr: boolean; enabled: boolean; authedFetch: ReturnType<typeof useAuth>["authedFetch"]; onChanged: () => void;
}) {
  const [setup, setSetup] = React.useState<{ otpauthUrl: string; secret: string } | null>(null);
  const [code, setCode] = React.useState("");

  const begin = useMutation({
    mutationFn: () => authedFetch<{ otpauthUrl: string; secret: string }>("/auth/2fa/setup", { method: "POST", body: "{}" }),
    onSuccess: (d) => setSetup(d),
  });
  const enable = useMutation({
    mutationFn: () => authedFetch("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) }),
    onSuccess: () => { setSetup(null); onChanged(); },
  });
  const disable = useMutation({
    mutationFn: () => authedFetch("/auth/2fa/disable", { method: "POST", body: "{}" }),
    onSuccess: onChanged,
  });

  return (
    <SectionCard icon={ShieldCheck} title={isAr ? "المصادقة الثنائية" : "Two-factor authentication"} desc={isAr ? "طبقة أمان إضافية عبر تطبيق المصادقة" : "Extra security via an authenticator app"}>
      <div className="flex items-center justify-between">
        <Badge variant={enabled ? "success" : "secondary"}>{enabled ? (isAr ? "مفعّل" : "Enabled") : (isAr ? "غير مفعّل" : "Disabled")}</Badge>
        {enabled ? (
          <Button variant="outline" size="sm" onClick={() => disable.mutate()} disabled={disable.isPending}>
            {disable.isPending && <Loader2 className="size-4 animate-spin" />}{isAr ? "تعطيل" : "Disable"}
          </Button>
        ) : !setup ? (
          <Button variant="outline" size="sm" onClick={() => begin.mutate()} disabled={begin.isPending}>
            {begin.isPending && <Loader2 className="size-4 animate-spin" />}{isAr ? "تفعيل" : "Enable"}
          </Button>
        ) : null}
      </div>

      {setup && (
        <div className="mt-4 space-y-3 rounded-xl bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">{isAr ? "أضف هذا السر إلى تطبيق المصادقة، ثم أدخل الرمز:" : "Add this secret to your authenticator app, then enter the code:"}</p>
          <code className="block break-all rounded-lg bg-background p-2 text-xs">{setup.secret}</code>
          <Field label={isAr ? "الرمز" : "Code"} value={code} onChange={setCode} placeholder="123456" />
          {enable.error && <p className="text-sm text-destructive">{enable.error.message}</p>}
          <Button size="sm" onClick={() => enable.mutate()} disabled={enable.isPending || code.length !== 6}>
            {enable.isPending && <Loader2 className="size-4 animate-spin" />}{isAr ? "تأكيد التفعيل" : "Confirm & enable"}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
