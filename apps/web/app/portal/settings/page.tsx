"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Lock, ShieldCheck, Loader2, Check, CalendarDays, Download, Trash2, AlertTriangle, BellRing, Sparkles, ArrowRight } from "lucide-react";
import { Card, Badge, Button, Skeleton, cn } from "@moraqat/ui";
import { QRCodeSVG } from "qrcode.react";
import { friendlyMessage } from "@/lib/errors";
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
          <AboutMoracatSection isAr={isAr} />
          <NotificationsSection isAr={isAr} authedFetch={authedFetch} />
          <PasswordSection isAr={isAr} authedFetch={authedFetch} logout={logout} />
          <TwoFactorSection isAr={isAr} enabled={profile.twoFactorEnabled} authedFetch={authedFetch} onChanged={() => qc.invalidateQueries({ queryKey: ["profile"] })} />
          <DangerZoneSection isAr={isAr} authedFetch={authedFetch} logout={logout} />
        </>
      )}
    </div>
  );
}

/** Email notification preferences by category (R107 prayer-aware timing later). */
function NotificationsSection({ isAr, authedFetch }: { isAr: boolean; authedFetch: ReturnType<typeof useAuth>["authedFetch"] }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notif-prefs"],
    queryFn: () => authedFetch<{ category: string; enabled: boolean }[]>("/account/notification-preferences"),
  });
  const toggle = useMutation({
    mutationFn: (body: { category: string; enabled: boolean }) =>
      authedFetch("/account/notification-preferences", { method: "PATCH", body: JSON.stringify(body) }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["notif-prefs"] });
      const prev = qc.getQueryData<{ category: string; enabled: boolean }[]>(["notif-prefs"]);
      qc.setQueryData<{ category: string; enabled: boolean }[]>(["notif-prefs"], (old) => old?.map((p) => (p.category === body.category ? body : p)));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["notif-prefs"], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notif-prefs"] }),
  });

  const LABELS: Record<string, { en: string; ar: string; desc_en: string; desc_ar: string }> = {
    COMMUNITY: { en: "Community", ar: "المجتمع", desc_en: "Likes, features and moderation on your cats", desc_ar: "الإعجابات والتمييز والإشراف على قططك" },
    SYSTEM: { en: "Account & security", ar: "الحساب والأمان", desc_en: "Sign-in, password and important notices", desc_ar: "تسجيل الدخول وكلمة المرور والتنبيهات المهمة" },
    PROMOTION: { en: "News & offers", ar: "الأخبار والعروض", desc_en: "Occasional product news (off by default)", desc_ar: "أخبار المنتج من حين لآخر (معطّلة افتراضياً)" },
  };

  return (
    <SectionCard icon={BellRing} title={isAr ? "الإشعارات" : "Notifications"} desc={isAr ? "تحكّم في رسائل البريد حسب الفئة" : "Control email by category"}>
      <div className="divide-y divide-border">
        {(data ?? []).map((p) => {
          const l = LABELS[p.category];
          return (
            <div key={p.category} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{l ? (isAr ? l.ar : l.en) : p.category}</p>
                {l && <p className="text-xs text-muted-foreground">{isAr ? l.desc_ar : l.desc_en}</p>}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={p.enabled}
                aria-label={l ? (isAr ? l.ar : l.en) : p.category}
                onClick={() => toggle.mutate({ category: p.category, enabled: !p.enabled })}
                className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", p.enabled ? "bg-primary" : "bg-input")}
              >
                <span className={cn("inline-block size-4 rounded-full bg-white transition-transform", p.enabled ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1")} />
              </button>
            </div>
          );
        })}
        {!data && <Skeleton className="h-24 w-full" />}
      </div>
    </SectionCard>
  );
}

/** PDPL rights — export everything we hold, and leave with dignity (R010/R106). */
function DangerZoneSection({ isAr, authedFetch, logout }: {
  isAr: boolean; authedFetch: ReturnType<typeof useAuth>["authedFetch"]; logout: () => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);

  const exportData = useMutation({
    mutationFn: () => authedFetch<Record<string, unknown>>("/account/export"),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "moracat-my-data.json";
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const del = useMutation({
    mutationFn: () =>
      authedFetch("/account/delete", { method: "POST", body: JSON.stringify({ password: password || undefined, confirm }) }),
    onSuccess: () => {
      void logout().finally(() => router.replace("/?farewell=1"));
    },
  });

  return (
    <SectionCard
      icon={AlertTriangle}
      title={isAr ? "بياناتك وحسابك" : "Your data & account"}
      desc={isAr ? "صدّر بياناتك أو احذف حسابك في أي وقت" : "Export your data or delete your account anytime"}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{isAr ? "تصدير بياناتي" : "Export my data"}</p>
            <p className="text-xs text-muted-foreground">
              {isAr ? "نزّل نسخة كاملة (JSON) من كل ما نحتفظ به عنك." : "Download a complete copy (JSON) of everything we hold about you."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportData.mutate()} disabled={exportData.isPending} className="w-fit">
            {exportData.isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {isAr ? "تصدير" : "Export"}
          </Button>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          {!open ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-destructive">{isAr ? "حذف الحساب" : "Delete account"}</p>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "سنخفي قططك من المجتمع ونُخفي هويتك. سجلات الفواتير تُحفظ مجهّلة كما يقتضي النظام."
                    : "We'll remove your cats from the community and anonymize your identity. Billing records are kept de-identified as required by law."}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="w-fit border-destructive/40 text-destructive hover:bg-destructive/10">
                <Trash2 className="size-4" />
                {isAr ? "حذف حسابي" : "Delete my account"}
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); del.mutate(); }} className="grid gap-3">
              <p className="text-sm font-medium text-destructive">{isAr ? "هل أنت متأكد؟ لا يمكن التراجع." : "Are you sure? This can't be undone."}</p>
              <Field
                label={isAr ? "كلمة المرور (إن وُجدت)" : "Password (if you have one)"}
                type="password"
                value={password}
                onChange={setPassword}
                hint={isAr ? "حسابات جوجل: فعّل التأكيد بالأسفل بدلًا من ذلك." : "Google accounts: tick the confirmation below instead."}
              />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 size-4 accent-[hsl(var(--destructive))]" />
                <span>{isAr ? "أفهم أنه سيتم حذف حسابي وإخفاء قططي من المجتمع." : "I understand my account will be deleted and my cats removed from the community."}</span>
              </label>
              {del.error && <p role="alert" className="text-sm text-destructive">{del.error.message}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="destructive" size="sm" disabled={del.isPending || (!password && !confirm)} className="w-fit">
                  {del.isPending && <Loader2 className="size-4 animate-spin" />}
                  {isAr ? "احذف حسابي نهائيًا" : "Permanently delete"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setPassword(""); setConfirm(false); }} className="w-fit">
                  {isAr ? "إلغاء" : "Cancel"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </SectionCard>
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

/** A quiet entry point back to the "What is Moracat?" story (revisitable anytime). */
function AboutMoracatSection({ isAr }: { isAr: boolean }) {
  return (
    <SectionCard icon={Sparkles} title={isAr ? "عن مرقط" : "About Moracat"} desc={isAr ? "ما هو مرقط وما الذي تفتحه العضوية" : "What Moracat is and what membership unlocks"}>
      <Link href="/about" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
        {isAr ? "اقرأ قصة مرقط" : "Read the Moracat story"} <ArrowRight className="size-4 rtl:rotate-180" />
      </Link>
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

function PasswordSection({ isAr, authedFetch, logout }: {
  isAr: boolean; authedFetch: ReturnType<typeof useAuth>["authedFetch"]; logout: () => Promise<void>;
}) {
  const router = useRouter();
  const [f, setF] = React.useState({ currentPassword: "", newPassword: "" });
  const [done, setDone] = React.useState(false);
  const change = useMutation({
    mutationFn: (body: Record<string, unknown>) => authedFetch("/account/change-password", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      // Confirm success first, then wind the session down cleanly. Changing the
      // password revokes every session, so we sign out and send them to /login
      // with the reason — never a silent bounce, never a stuck spinner.
      setF({ currentPassword: "", newPassword: "" });
      setDone(true);
      window.setTimeout(() => {
        void logout().finally(() => router.replace("/login?reason=password-changed"));
      }, 1600);
    },
  });

  if (done) {
    return (
      <SectionCard icon={Lock} title={isAr ? "كلمة المرور" : "Password"} desc={isAr ? "تم التحديث بنجاح" : "Updated successfully"}>
        <div className="flex items-start gap-3 rounded-xl bg-primary/5 p-4">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"><Check className="size-4" /></span>
          <div className="space-y-1">
            <p className="text-sm font-medium">{isAr ? "تم تغيير كلمة المرور" : "Password changed"}</p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {isAr
                ? "لأمانك، سنسجّل خروجك من جميع الأجهزة وننقلك لتسجيل الدخول بكلمتك الجديدة…"
                : "For your security, we're signing you out on all devices and taking you to sign in with your new password…"}
            </p>
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard icon={Lock} title={isAr ? "كلمة المرور" : "Password"} desc={isAr ? "تغيير كلمة المرور يسجّل خروجك من كل الأجهزة" : "Changing your password signs you out on every device"}>
      <form onSubmit={(e) => { e.preventDefault(); change.mutate(f); }} className="grid gap-4">
        <Field label={isAr ? "كلمة المرور الحالية" : "Current password"} type="password" required value={f.currentPassword} onChange={(v) => setF({ ...f, currentPassword: v })} />
        <Field label={isAr ? "كلمة المرور الجديدة" : "New password"} type="password" required value={f.newPassword} onChange={(v) => setF({ ...f, newPassword: v })} />
        <p className="text-xs text-muted-foreground">
          {isAr
            ? "بعد التغيير سنسجّل خروجك وتسجّل الدخول من جديد بكلمة المرور الجديدة."
            : "After changing it, you'll be signed out and asked to sign in again with the new password."}
        </p>
        {change.error && <p role="alert" className="text-sm text-destructive">{change.error.message}</p>}
        <Button type="submit" variant="outline" disabled={change.isPending || !f.currentPassword || !f.newPassword} className="w-fit">
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
            <p role="alert" className="text-sm text-destructive">{friendlyMessage(disable.error, isAr)}</p>
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
          <p className="text-sm text-muted-foreground">{isAr ? "امسح الرمز بتطبيق المصادقة، ثم أدخل الرمز المكوّن من ٦ أرقام:" : "Scan with your authenticator app, then enter the 6-digit code:"}</p>
          {/* The QR is the human path (hand-typing base32 is an effort tax, R002);
              the secret stays below as the copyable fallback. */}
          <div className="flex justify-center rounded-lg bg-white p-4" dir="ltr">
            <QRCodeSVG value={setup.otpauthUrl} size={168} aria-label={isAr ? "رمز QR لإعداد المصادقة الثنائية" : "Two-factor setup QR code"} />
          </div>
          <p className="text-xs text-muted-foreground">{isAr ? "أو أدخل السر يدوياً:" : "Or enter the secret manually:"}</p>
          <code className="block break-all rounded-lg bg-background p-2 text-xs" dir="ltr">{setup.secret}</code>
          <Field label={isAr ? "الرمز" : "Code"} value={code} onChange={setCode} placeholder="123456" />
          {enable.error && <p role="alert" className="text-sm text-destructive">{friendlyMessage(enable.error, isAr)}</p>}
          <Button size="sm" onClick={() => enable.mutate()} disabled={enable.isPending || code.length !== 6}>
            {enable.isPending && <Loader2 className="size-4 animate-spin" />}{isAr ? "تأكيد التفعيل" : "Confirm & enable"}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
