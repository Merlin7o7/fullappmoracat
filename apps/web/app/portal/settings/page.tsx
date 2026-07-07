"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Lock, ShieldCheck, Loader2, Check, CalendarDays } from "lucide-react";
import { Card, Badge, Button, Skeleton, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { buildGreeting, type Gender } from "@/lib/greeting";
import { formatDate, type CalendarPref } from "@/lib/datetime";
import { Field } from "@/components/field";
import { PhotoUploader } from "@/components/photo-uploader";
import { QueryError } from "@/components/query-error";

interface Profile {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string;
  locale: string;
  twoFactorEnabled: boolean;
  gender?: Gender;
  avatarUrl?: string | null;
  emailVerified?: boolean;
}

export default function SettingsPage() {
  const { authedFetch, user, logout } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const qc = useQueryClient();

  const { data: profile, isLoading, isError, refetch, isFetching } = useQuery({
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

      {isError ? (
        <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
      ) : isLoading || !profile ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <ProfileSection
            isAr={isAr}
            profile={profile}
            authedFetch={authedFetch}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["profile"] });
              qc.invalidateQueries({ queryKey: ["overview"] }); // the greeting lives there
            }}
          />
          <PreferencesSection isAr={isAr} />
          <PasswordSection isAr={isAr} authedFetch={authedFetch} onChanged={() => logout()} />
          <TwoFactorSection isAr={isAr} enabled={profile.twoFactorEnabled} authedFetch={authedFetch} onChanged={() => qc.invalidateQueries({ queryKey: ["profile"] })} />
        </>
      )}
    </div>
  );
}

/** Date-calendar preference — Hijri, Gregorian, or auto (by language). */
function PreferencesSection({ isAr }: { isAr: boolean }) {
  const { calendar, setCalendar } = useLocale();
  const options: { value: CalendarPref; label: string; hint: string }[] = [
    { value: "auto", label: isAr ? "تلقائي" : "Automatic", hint: isAr ? "هجري مع العربية، ميلادي مع الإنجليزية" : "Hijri in Arabic, Gregorian in English" },
    { value: "hijri", label: isAr ? "هجري" : "Hijri", hint: isAr ? "تقويم أم القرى" : "Umm al-Qura calendar" },
    { value: "gregorian", label: isAr ? "ميلادي" : "Gregorian", hint: isAr ? "التقويم الميلادي" : "Gregorian calendar" },
  ];
  // Live preview reflects the chosen preference immediately.
  const preview = formatDate(new Date(), isAr ? "ar" : "en", { day: "numeric", month: "long", year: "numeric" });

  return (
    <SectionCard
      icon={CalendarDays}
      title={isAr ? "التقويم" : "Calendar"}
      desc={isAr ? "كيف تُعرض التواريخ في كل المنصة" : "How dates are shown across the platform"}
    >
      <div role="radiogroup" aria-label={isAr ? "نوع التقويم" : "Calendar type"} className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const active = calendar === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setCalendar(o.value)}
              className={cn(
                "rounded-2xl border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{o.label}</span>
                {active && <Check className="size-4 text-primary" />}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{o.hint}</p>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {isAr ? "مثال: " : "Preview: "}
        <span className="font-medium text-foreground" dir="auto">{preview}</span>
      </p>
    </SectionCard>
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
  const { updateUser } = useAuth();
  const { primaryCat } = useCats();
  const [f, setF] = React.useState({
    firstName: profile.firstName ?? "", lastName: profile.lastName ?? "", phone: profile.phone ?? "",
    gender: (profile.gender ?? "UNSPECIFIED") as Gender,
  });
  const [saved, setSaved] = React.useState(false);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => authedFetch("/account/profile", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { updateUser({ gender: f.gender }); onSaved(); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  // A greeting they can try on before saving — asked here, never at signup
  // (postponed on purpose; Dossier onboarding rules).
  const preview = buildGreeting({ locale: isAr ? "ar" : "en", gender: f.gender, primaryCatName: primaryCat?.name, firstName: f.firstName });
  const greetOpts: { key: Gender; ar: string; en: string }[] = [
    { key: "MALE", ar: "أبو القط", en: "Their dad" },
    { key: "FEMALE", ar: "أم القط", en: "Their mom" },
    { key: "UNSPECIFIED", ar: "أهل القط", en: "Their family" },
  ];

  return (
    <SectionCard icon={User} title={isAr ? "الملف الشخصي" : "Profile"} desc={profile.email}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Omit blanks — an empty phone must never block saving the rest (R115).
          save.mutate({
            firstName: f.firstName.trim() || undefined,
            lastName: f.lastName.trim() || undefined,
            phone: f.phone.trim() || undefined,
            gender: f.gender,
          });
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <PhotoUploader
            endpoint="/account/avatar"
            aspect={1}
            rounded
            maxEdge={512}
            currentUrl={profile.avatarUrl ?? null}
            isAr={isAr}
            label={isAr ? "الصورة الشخصية" : "Profile picture"}
            onUploaded={() => onSaved()}
          />
        </div>
        <Field label={isAr ? "الاسم الأول" : "First name"} value={f.firstName} onChange={(v) => setF({ ...f, firstName: v })} />
        <Field label={isAr ? "اسم العائلة" : "Last name"} value={f.lastName} onChange={(v) => setF({ ...f, lastName: v })} />
        <Field label={isAr ? "الجوال" : "Phone"} value={f.phone} onChange={(v) => setF({ ...f, phone: v })} placeholder="+9665..." className="sm:col-span-2" />

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium">{isAr ? "كيف نحيّيك؟" : "How should we greet you?"}</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={isAr ? "كيف نحيّيك؟" : "How should we greet you?"}>
            {greetOpts.map((o) => (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={f.gender === o.key}
                onClick={() => setF({ ...f, gender: o.key })}
                className={cn(
                  "rounded-xl border px-2 py-2.5 text-sm font-medium transition-colors",
                  f.gender === o.key ? "border-primary bg-primary/10 text-foreground" : "border-input text-muted-foreground hover:bg-muted"
                )}
              >
                {isAr ? o.ar : o.en}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {isAr ? "بيطلع لك: " : "You'll be greeted with: "}
            <span className="font-medium text-foreground/80">{preview.title}</span>
          </p>
        </div>

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
        {change.error && <p role="alert" className="text-sm text-destructive">{change.error.message}</p>}
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
  const [disarming, setDisarming] = React.useState(false);
  const [password, setPassword] = React.useState("");

  const begin = useMutation({
    mutationFn: () => authedFetch<{ otpauthUrl: string; secret: string }>("/auth/2fa/setup", { method: "POST", body: "{}" }),
    onSuccess: (d) => setSetup(d),
  });
  const enable = useMutation({
    mutationFn: () => authedFetch("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) }),
    onSuccess: () => { setSetup(null); setCode(""); onChanged(); },
  });
  const disable = useMutation({
    // Re-authenticate before stripping the account's strongest control.
    mutationFn: () => authedFetch("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password }) }),
    onSuccess: () => { setDisarming(false); setPassword(""); onChanged(); },
  });

  return (
    <SectionCard icon={ShieldCheck} title={isAr ? "المصادقة الثنائية" : "Two-factor authentication"} desc={isAr ? "طبقة أمان إضافية عبر تطبيق المصادقة" : "Extra security via an authenticator app"}>
      <div className="flex items-center justify-between">
        <Badge variant={enabled ? "success" : "secondary"}>{enabled ? (isAr ? "مفعّل" : "Enabled") : (isAr ? "غير مفعّل" : "Disabled")}</Badge>
        {enabled ? (
          !disarming ? (
            <Button variant="outline" size="sm" onClick={() => { disable.reset(); setDisarming(true); }}>
              {isAr ? "تعطيل" : "Disable"}
            </Button>
          ) : null
        ) : !setup ? (
          <Button variant="outline" size="sm" onClick={() => begin.mutate()} disabled={begin.isPending}>
            {begin.isPending && <Loader2 className="size-4 animate-spin" />}{isAr ? "تفعيل" : "Enable"}
          </Button>
        ) : null}
      </div>

      {enabled && disarming && (
        <form
          className="mt-4 space-y-3 rounded-xl bg-muted/50 p-4"
          onSubmit={(e) => { e.preventDefault(); disable.mutate(); }}
        >
          <p className="text-sm text-muted-foreground">
            {isAr ? "أكّد كلمة مرورك لتعطيل المصادقة الثنائية." : "Confirm your password to turn off two-factor authentication."}
          </p>
          <Field type="password" label={isAr ? "كلمة المرور" : "Password"} value={password} onChange={setPassword} placeholder="••••••••" />
          {disable.error && (
            <p role="alert" className="text-sm text-destructive">{disable.error.message}</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="outline" size="sm" disabled={disable.isPending || !password}>
              {disable.isPending && <Loader2 className="size-4 animate-spin" />}{isAr ? "تأكيد التعطيل" : "Confirm & disable"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setDisarming(false); setPassword(""); disable.reset(); }}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
          </div>
        </form>
      )}

      {setup && (
        <div className="mt-4 space-y-3 rounded-xl bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">{isAr ? "أضف هذا السر إلى تطبيق المصادقة، ثم أدخل الرمز:" : "Add this secret to your authenticator app, then enter the code:"}</p>
          <code className="block break-all rounded-lg bg-background p-2 text-xs">{setup.secret}</code>
          <Field label={isAr ? "الرمز" : "Code"} value={code} onChange={setCode} placeholder="123456" />
          {enable.error && <p role="alert" className="text-sm text-destructive">{enable.error.message}</p>}
          <Button size="sm" onClick={() => enable.mutate()} disabled={enable.isPending || code.length !== 6}>
            {enable.isPending && <Loader2 className="size-4 animate-spin" />}{isAr ? "تأكيد التفعيل" : "Confirm & enable"}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
