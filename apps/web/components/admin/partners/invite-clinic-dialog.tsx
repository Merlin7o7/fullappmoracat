"use client";

/**
 * Invite a clinic — the only front door to the partner network (MRC-VET-002:
 * admin-invite-only). A side drawer, not a page: the reviewer keeps the
 * pipeline in view behind it and lands back on it when done.
 *
 * Validation happens inline and in both languages before anything is sent
 * (R115 prevent > apologise); nothing typed is lost on an API error (R117).
 */

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Mail, CalendarClock, AlertTriangle } from "lucide-react";
import { Button, Drawer, Input, useToast, cn } from "@moraqat/ui";
import { normalizeSaudiMobile } from "@moraqat/core";
import {
  useRegistrationApi,
  registrationError,
  type InviteClinicInput,
  type InviteClinicResult,
} from "@/lib/vet-registration";
import { fmtDate } from "@/app/admin/_components/i18n";
import { fieldClass } from "./shared";

type Tier = "founding" | "standard";

interface FormState {
  nameAr: string;
  nameEn: string;
  contactName: string;
  email: string;
  phone: string;
  tier: Tier;
  note: string;
}

const EMPTY: FormState = { nameAr: "", nameEn: "", contactName: "", email: "", phone: "", tier: "standard", note: "" };

type Errors = Partial<Record<keyof FormState, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(f: FormState, isAr: boolean): Errors {
  const e: Errors = {};
  if (f.nameAr.trim().length < 2) {
    e.nameAr = isAr ? "اكتب اسم العيادة بالعربية (حرفان على الأقل)." : "Enter the clinic name in Arabic (at least 2 characters).";
  }
  if (f.nameEn.trim().length > 160) {
    e.nameEn = isAr ? "الاسم أطول من ١٦٠ حرفاً." : "The name is longer than 160 characters.";
  }
  if (f.contactName.trim().length < 2) {
    e.contactName = isAr ? "اكتب اسم الشخص المسؤول." : "Enter the contact person's name.";
  }
  if (!f.email.trim()) {
    e.email = isAr ? "البريد مطلوب — إليه تُرسل الدعوة." : "Email is required — the invitation goes there.";
  } else if (!EMAIL_RE.test(f.email.trim())) {
    e.email = isAr ? "صيغة البريد غير صحيحة." : "That email doesn't look right.";
  }
  if (!f.phone.trim()) {
    e.phone = isAr ? "رقم الجوال مطلوب." : "Mobile number is required.";
  } else if (!normalizeSaudiMobile(f.phone)) {
    e.phone = isAr ? "اكتب رقم جوال سعودي مثل 05XXXXXXXX." : "Enter a Saudi mobile like 05XXXXXXXX.";
  }
  if (f.note.length > 1000) {
    e.note = isAr ? "الملاحظة طويلة جداً." : "The note is too long.";
  }
  return e;
}

export function InviteClinicDialog({ open, onClose, isAr }: { open: boolean; onClose: () => void; isAr: boolean }) {
  const api = useRegistrationApi();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [errors, setErrors] = React.useState<Errors>({});
  const [touched, setTouched] = React.useState(false);
  const [result, setResult] = React.useState<InviteClinicResult | null>(null);
  const [apiError, setApiError] = React.useState<{ title: string; message: string; orgId?: string } | null>(null);
  const firstFieldRef = React.useRef<HTMLInputElement>(null);

  // Fresh form each time the drawer opens.
  React.useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setErrors({});
      setTouched(false);
      setResult(null);
      setApiError(null);
      const t = setTimeout(() => firstFieldRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const invite = useMutation({
    mutationFn: (input: InviteClinicInput) => api.adminInvite(input),
    onSuccess: (res) => {
      setResult(res);
      setApiError(null);
      void qc.invalidateQueries({ queryKey: ["admin-clinics"] });
      toast({
        title: isAr ? "أُرسلت الدعوة" : "Invitation sent",
        description: isAr ? `وصلت إلى ${res.invite.email}` : `Sent to ${res.invite.email}`,
        variant: "success",
      });
    },
    onError: (err) => {
      const f = registrationError(err, isAr);
      const extras = (err as { extras?: Record<string, unknown> })?.extras;
      const orgId = typeof extras?.orgId === "string" ? extras.orgId : undefined;
      setApiError({ title: f.title, message: f.message, orgId });
      toast({ title: f.title, description: f.message, variant: "error" });
    },
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    const next = { ...form, [key]: value };
    setForm(next);
    // Once the reviewer has tried to submit, errors clear live as they fix them.
    if (touched) setErrors(validate(next, isAr));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const errs = validate(form, isAr);
    setErrors(errs);
    const firstBad = (Object.keys(errs) as (keyof FormState)[])[0];
    if (firstBad) {
      document.getElementById(`invite-${firstBad}`)?.focus();
      return;
    }
    invite.mutate({
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim() || undefined,
      contactName: form.contactName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: normalizeSaudiMobile(form.phone) ?? form.phone.trim(),
      tier: form.tier,
      note: form.note.trim() || undefined,
    });
  };

  const inviteAnother = () => {
    setForm(EMPTY);
    setErrors({});
    setTouched(false);
    setResult(null);
    setApiError(null);
    setTimeout(() => firstFieldRef.current?.focus(), 50);
  };

  const close = invite.isPending ? () => {} : onClose;

  return (
    <Drawer open={open} onClose={close} title={isAr ? "دعوة عيادة" : "Invite a clinic"} className="sm:max-w-lg">
      {result ? (
        <div className="space-y-5" role="status" aria-live="polite">
          <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/5 p-4">
            <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
            <div className="min-w-0">
              <p className="font-medium">
                {isAr ? `دُعيت ${result.org.nameAr}` : `${result.org.nameEn || result.org.nameAr} is invited`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isAr
                  ? "يصل المالك رابط شخصي لإنشاء حسابه وتعبئة التسجيل. ستظهر العيادة في القائمة بحالة «تمت الدعوة»."
                  : "The owner gets a personal link to create their account and complete registration. The clinic now shows as “Invited” in the list."}
              </p>
            </div>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Mail aria-hidden className="size-4 text-muted-foreground" />
              <dt className="text-muted-foreground">{isAr ? "أُرسلت إلى" : "Emailed to"}</dt>
              <dd className="font-medium" dir="ltr">
                {result.invite.email}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock aria-hidden className="size-4 text-muted-foreground" />
              <dt className="text-muted-foreground">{isAr ? "الرابط صالح حتى" : "Link valid until"}</dt>
              <dd className="font-medium">{fmtDate(result.invite.expiresAt, isAr)}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/partners/${result.org.id}`}
              className="inline-flex h-11 items-center rounded-full bg-secondary px-5 text-sm font-medium text-secondary-foreground hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isAr ? "فتح ملف العيادة" : "Open clinic record"}
            </Link>
            <Button variant="outline" onClick={inviteAnother}>
              {isAr ? "دعوة عيادة أخرى" : "Invite another clinic"}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {isAr ? "تم" : "Done"}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "الانضمام للشبكة بالدعوة فقط. يصل المالك بريد برابط شخصي صالح ١٤ يوماً."
              : "The network is invitation-only. The owner receives a personal link valid for 14 days."}
          </p>

          {apiError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">{apiError.title}</p>
                <p className="text-muted-foreground">{apiError.message}</p>
                {apiError.orgId && (
                  <Link
                    href={`/admin/partners/${apiError.orgId}`}
                    className="mt-1 inline-flex min-h-[44px] items-center font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {isAr ? "فتح التسجيل القائم" : "Open the existing registration"}
                  </Link>
                )}
              </div>
            </div>
          )}

          <Field id="invite-nameAr" label={isAr ? "اسم العيادة بالعربية" : "Clinic name (Arabic)"} required error={errors.nameAr} isAr={isAr}>
            <Input
              ref={firstFieldRef}
              id="invite-nameAr"
              dir="rtl"
              lang="ar"
              value={form.nameAr}
              onChange={(e) => set("nameAr", e.target.value)}
              invalid={!!errors.nameAr}
              aria-describedby={errors.nameAr ? "invite-nameAr-error" : undefined}
              maxLength={160}
              autoComplete="organization"
            />
          </Field>

          <Field
            id="invite-nameEn"
            label={isAr ? "اسم العيادة بالإنجليزية" : "Clinic name (English)"}
            hint={isAr ? "اختياري — يكمله المالك لاحقاً." : "Optional — the owner can add it later."}
            error={errors.nameEn}
            isAr={isAr}
          >
            <Input
              id="invite-nameEn"
              dir="ltr"
              lang="en"
              value={form.nameEn}
              onChange={(e) => set("nameEn", e.target.value)}
              invalid={!!errors.nameEn}
              aria-describedby={errors.nameEn ? "invite-nameEn-error" : "invite-nameEn-hint"}
              maxLength={160}
            />
          </Field>

          <Field id="invite-contactName" label={isAr ? "الشخص المسؤول" : "Contact person"} required error={errors.contactName} isAr={isAr}>
            <Input
              id="invite-contactName"
              value={form.contactName}
              onChange={(e) => set("contactName", e.target.value)}
              invalid={!!errors.contactName}
              aria-describedby={errors.contactName ? "invite-contactName-error" : undefined}
              maxLength={120}
              autoComplete="name"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="invite-email" label={isAr ? "البريد الإلكتروني" : "Email"} required error={errors.email} isAr={isAr}>
              <Input
                id="invite-email"
                type="email"
                dir="ltr"
                inputMode="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                invalid={!!errors.email}
                aria-describedby={errors.email ? "invite-email-error" : undefined}
                autoComplete="email"
                placeholder="name@clinic.sa"
              />
            </Field>
            <Field id="invite-phone" label={isAr ? "رقم الجوال" : "Mobile"} required error={errors.phone} isAr={isAr}>
              <Input
                id="invite-phone"
                type="tel"
                dir="ltr"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                invalid={!!errors.phone}
                aria-describedby={errors.phone ? "invite-phone-error" : undefined}
                autoComplete="tel"
                placeholder="05XXXXXXXX"
              />
            </Field>
          </div>

          <Field id="invite-tier" label={isAr ? "الفئة" : "Tier"} isAr={isAr}>
            <select
              id="invite-tier"
              value={form.tier}
              onChange={(e) => set("tier", e.target.value as Tier)}
              className={cn(fieldClass, "h-11")}
            >
              <option value="founding">{isAr ? "مؤسس" : "Founding"}</option>
              <option value="standard">{isAr ? "قياسي" : "Standard"}</option>
            </select>
          </Field>

          <Field
            id="invite-note"
            label={isAr ? "ملاحظة داخلية" : "Internal note"}
            hint={isAr ? "اختياري — لا تظهر للعيادة أبداً." : "Optional — never shown to the clinic."}
            error={errors.note}
            isAr={isAr}
          >
            <textarea
              id="invite-note"
              rows={3}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              aria-describedby={errors.note ? "invite-note-error" : "invite-note-hint"}
              aria-invalid={!!errors.note || undefined}
              maxLength={1000}
              className={cn(fieldClass, "resize-none py-2")}
            />
          </Field>

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={invite.isPending}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="submit" loading={invite.isPending}>
              {invite.isPending ? (isAr ? "جارٍ إرسال الدعوة…" : "Sending invitation…") : isAr ? "إرسال الدعوة" : "Send invitation"}
            </Button>
          </div>
        </form>
      )}
    </Drawer>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  required,
  isAr,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  isAr: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
        {required && <span className="sr-only">{isAr ? " (مطلوب)" : " (required)"}</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
