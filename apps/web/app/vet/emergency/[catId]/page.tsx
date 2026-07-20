"use client";

// ════════════════════════════════════════════════════════════════════════
//  Emergency access — break-glass (MRC-VET-001 §09 mode C).
//
//  "One red button … skips all forms, opens T0 identity + alerts + emergency
//  contact instantly. Paperwork after the cat is safe."
//
//  ── Design decisions, and why ──────────────────────────────────────────
//
//  1. REASON FIRST, AND ONLY THAT. Break-glass without a reason is not
//     break-glass, it is a back door. So exactly one gate stands between the
//     clinician and the data: a reason, in one tap (presets) or one line.
//     Nothing else — no confirm dialog, no "are you sure", no second screen.
//     The gate costs about three seconds and it is the entire accountability
//     model.
//
//  2. ZERO CHROME AFTER THE GATE. No nav, no tabs, no cards-about-cards. The
//     person reading this has a collapsing cat on a table and is holding a
//     tablet at arm's length. Type steps up to display sizes, status uses
//     SOLID fills rather than the tinted chips the rest of the portal uses,
//     and every target is at least 56–64px — well past the 44px floor
//     (R092), because the reader's hands are not steady.
//
//  3. CONTACTS ARE BUTTONS, NOT TEXT. Owner and emergency contact are `tel:`
//     targets sized like phone keys. In an emergency the most valuable thing
//     this product can do is connect a vet to the person who knows the cat's
//     history — one tap, no transcription. The masked number is NOT shown
//     here: break-glass has already released the real one, and making a vet
//     squint at dots would be theatre.
//
//  4. TRANSPARENCY IS PERSISTENT, NOT A TOAST. The banner stating that the
//     access was logged and the owner notified stays on screen for the whole
//     session, and it carries the access id so it can be quoted in a dispute.
//     A toast fades; accountability must not. It is also stated BEFORE the
//     gate, so nobody discovers it afterwards (R115: prevent, don't apologise).
//
//  5. NOTHING IS EXAGGERATED. Urgent, not panicked — no flashing, no sirens,
//     no red wash across content the vet must read. Red is spent exclusively
//     on the alerts, so it still means something. Reduced motion is honoured
//     by having essentially no motion at all.
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Cat, Phone, ShieldCheck, Siren } from "lucide-react";
import { Button, Input, cn, useToast } from "@moraqat/ui";
import { VET_ROLE_LABELS } from "@moraqat/core";
import { useLocale } from "@/app/providers";
import { formatDateTime } from "@/lib/datetime";
import { AlertsBand } from "@/components/vet/alerts-band";
import {
  formatCatAge,
  useVetActor,
  useVetApi,
  vetFriendlyError,
  type EmergencyPayload,
  flattenTier0Alerts,
} from "@/lib/vet-api";

const PRESETS: { value: string; ar: string; en: string }[] = [
  { value: "COLLAPSE", ar: "انهيار / فقدان وعي", en: "Collapse / unresponsive" },
  { value: "TRAUMA", ar: "إصابة أو حادث", en: "Trauma or accident" },
  { value: "BREATHING", ar: "ضيق تنفّس", en: "Respiratory distress" },
  { value: "SEIZURE", ar: "تشنّج", en: "Seizure" },
  { value: "POISONING", ar: "اشتباه تسمّم", en: "Suspected poisoning" },
  { value: "URINARY", ar: "انسداد بولي", en: "Urinary obstruction" },
  { value: "BLEEDING", ar: "نزيف", en: "Bleeding" },
  { value: "OTHER", ar: "أخرى", en: "Other" },
];

export default function EmergencyAccessPage({ params }: { params: { catId: string } }) {
  const { catId } = params;
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const actor = useVetActor();
  const api = useVetApi();

  const [payload, setPayload] = React.useState<EmergencyPayload | null>(null);
  const [preset, setPreset] = React.useState("");
  const [freeText, setFreeText] = React.useState("");
  const [error, setError] = React.useState("");

  const open = useMutation({
    mutationFn: (reason: string) => api.emergencyLookup({ identifier: catId, reason }),
    onSuccess: (data) => setPayload(data),
    onError: (err) => {
      const f = vetFriendlyError(err, isAr);
      setError(f.message);
      toast({ variant: "error", title: f.title, description: f.message });
    },
  });

  if (!actor.ready) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <p className="text-sm text-muted-foreground">{isAr ? "لحظة…" : "One moment…"}</p>
      </main>
    );
  }

  if (!actor.can("emergency.access")) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="font-display text-xl font-semibold">
          {isAr ? "الوصول الطارئ خارج نطاق دورك" : "Emergency access isn't part of your role"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {actor.role
            ? isAr
              ? `بصفتك ${VET_ROLE_LABELS[actor.role].ar}، هذا الإجراء غير متاح لك. أي طبيب أو مدير عيادة يقدر يفتحه فوراً.`
              : `As ${VET_ROLE_LABELS[actor.role].en}, this action isn't available to you. Any veterinarian or clinic manager can open it immediately.`
            : isAr
              ? "اختر عيادتك أولاً."
              : "Choose your clinic first."}
        </p>
      </main>
    );
  }

  // ── the gate ───────────────────────────────────────────────────────────
  if (!payload) {
    const picked = PRESETS.find((p) => p.value === preset);
    const reasonValue =
      !picked || preset === "OTHER"
        ? freeText.trim()
        : picked.en + (freeText.trim() ? ` — ${freeText.trim()}` : "");

    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col justify-center p-4 sm:p-6">
        <div className="rounded-3xl border-2 border-destructive/50 bg-card p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-destructive text-destructive-foreground">
              <Siren className="size-6" aria-hidden />
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                {isAr ? "وصول طارئ" : "Emergency access"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isAr
                  ? "يفتح الهوية والتنبيهات وجهات الاتصال فوراً."
                  : "Opens identity, alerts and contacts immediately."}
              </p>
            </div>
          </div>

          {/* Stated before the gate, not after — nobody should discover the
              logging once they're already inside. */}
          <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-border bg-muted/60 p-3.5">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <p className="text-sm leading-relaxed text-foreground">
              {isAr
                ? "هذا الوصول يُسجَّل باسمك ووقتك، ويصل المالك إشعار بأن عيادتكم فتحت ملف قطه في حالة طارئة. الشفافية هي ما يجعل هذا الباب مفتوحاً لك أصلاً."
                : "This access is logged under your name and time, and the owner is notified that your clinic opened their cat's file in an emergency. That transparency is precisely why this door is open to you at all."}
            </p>
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-foreground">
              {isAr ? "ما الحالة؟" : "What's happening?"}
            </legend>
            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={preset === p.value}
                  onClick={() => {
                    setPreset(p.value);
                    setError("");
                  }}
                  className={cn(
                    "min-h-[56px] rounded-2xl border-2 px-4 text-start text-base font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    preset === p.value
                      ? "border-destructive bg-destructive/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-destructive/40 hover:text-foreground"
                  )}
                >
                  {isAr ? p.ar : p.en}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-4">
            <label htmlFor="er-detail" className="block text-sm font-medium text-foreground">
              {!preset || preset === "OTHER"
                ? isAr
                  ? "صف الحالة"
                  : "Describe it"
                : isAr
                  ? "تفصيل إضافي (اختياري)"
                  : "Extra detail (optional)"}
            </label>
            <Input
              id="er-detail"
              value={freeText}
              onChange={(e) => {
                setFreeText(e.target.value);
                setError("");
              }}
              invalid={!!error}
              aria-describedby={error ? "er-detail-err" : undefined}
              className="mt-1.5 h-14 text-base"
              autoFocus
            />
            {error && (
              <p id="er-detail-err" role="alert" className="mt-1.5 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
          </div>

          <Button
            variant="destructive"
            size="xl"
            className="mt-5 h-16 w-full text-lg"
            loading={open.isPending}
            onClick={() => {
              if (reasonValue.length < 3) {
                setError(
                  isAr
                    ? "اختر سبباً أو اكتبه — سطر واحد يكفي."
                    : "Pick a reason or type one — a single line is enough."
                );
                return;
              }
              open.mutate(reasonValue);
            }}
          >
            {isAr ? "افتح الملف الآن" : "Open the file now"}
          </Button>

          <Link
            href={`/vet/patients/${catId}`}
            className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {isAr ? <ArrowRight className="size-4" aria-hidden /> : <ArrowLeft className="size-4" aria-hidden />}
            {isAr ? "رجوع للملف العادي" : "Back to the normal profile"}
          </Link>
        </div>
      </main>
    );
  }

  return <BreakGlassView payload={payload} />;
}

function BreakGlassView({ payload }: { payload: EmergencyPayload }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { owner } = payload;

  const contacts = [
    owner.phone
      ? {
          name: owner.firstName,
          phone: owner.phone,
          relation: isAr ? "المالك" : "Owner",
        }
      : null,
    owner.emergencyContactPhone
      ? {
          name: owner.emergencyContactName || (isAr ? "جهة الطوارئ" : "Emergency contact"),
          phone: owner.emergencyContactPhone,
          relation: isAr ? "للطوارئ" : "Emergency contact",
        }
      : null,
  ].filter(Boolean) as { name: string; phone: string; relation: string }[];

  return (
    <main className="min-h-[100dvh] bg-background">
      {/* Persistent transparency banner — never dismissible. */}
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-primary/30 bg-primary/10 px-4 py-3"
      >
        <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden />
        <p className="text-sm font-medium text-foreground">
          {isAr ? "تم تسجيل هذا الوصول" : "This access has been logged"}
          <span className="ms-1.5 font-mono tabular-nums text-muted-foreground">
            {formatDateTime(payload.accessedAt, locale)}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {isAr ? "· أُشعِر المالك باسم عيادتكم." : "· The owner was notified, naming your clinic."}
        </p>
        <p className="w-full font-mono text-xs text-muted-foreground">
          {isAr ? "رقم السجل" : "Access record"}: {payload.accessId}
        </p>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        {/* Identity, at arm's length. */}
        <div className="flex items-center gap-4">
          {payload.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={payload.photoUrl}
              alt=""
              className="size-24 shrink-0 rounded-2xl object-cover ring-2 ring-border sm:size-28"
            />
          ) : (
            <span className="grid size-24 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground sm:size-28">
              <Cat className="size-12" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {payload.name}
            </h1>
            <p className="mt-1 font-mono text-base tracking-wide text-muted-foreground">
              {payload.catIdNumber}
            </p>
            <p className="mt-1 text-lg text-foreground">
              {[
                payload.sex === "FEMALE"
                  ? isAr
                    ? "أنثى"
                    : "Female"
                  : payload.sex === "MALE"
                    ? isAr
                      ? "ذكر"
                      : "Male"
                    : "",
                formatCatAge(payload.ageMonths, isAr) ?? "",
                typeof payload.weightKg === "number"
                  ? `${payload.weightKg} ${isAr ? "كجم" : "kg"}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {payload.microchip && (
              <p className="mt-1 font-mono text-sm text-muted-foreground">
                {isAr ? "الشريحة" : "Microchip"}: {payload.microchip}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* The alerts, in display posture — the reason this screen exists. */}
      <AlertsBand alerts={flattenTier0Alerts(payload.alerts)} posture="display" catName={payload.name} />

      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        <h2 className="text-lg font-semibold text-foreground">{isAr ? "اتصل الآن" : "Call now"}</h2>
        <ul className="mt-3 space-y-2.5">
          {contacts.map((c, i) => (
            <li key={`${c.phone}-${i}`}>
              <a
                href={`tel:${c.phone}`}
                className="flex min-h-[64px] items-center gap-3 rounded-2xl border-2 border-primary/40 bg-primary/5 px-4 py-3 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Phone className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold text-foreground">{c.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {c.relation} · {isAr ? "اضغط للاتصال" : "Tap to call"}
                  </span>
                </span>
                <span className="font-mono text-lg tabular-nums text-primary" dir="ltr">
                  {c.phone}
                </span>
              </a>
            </li>
          ))}
          {contacts.length === 0 && (
            <li className="rounded-2xl border-2 border-warning/50 bg-warning/10 px-4 py-4">
              <p className="text-base font-medium text-foreground">
                {isAr ? "لا توجد جهة اتصال مسجّلة." : "No contact number is on record."}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {isAr
                  ? "تابع العلاج — لا تنتظر إذناً في حالة تهدّد الحياة."
                  : "Proceed with treatment — do not wait on consent in a life-threatening emergency."}
              </p>
            </li>
          )}
        </ul>

        {/* Paperwork after the cat is safe — one calm exit, never a trap. */}
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? `سبب الفتح المسجّل: «${payload.reason}». الورق بعد ما يستقر القط — سجّل ما حدث متى ما قدرت.`
              : `Recorded reason: “${payload.reason}”. Paperwork after the cat is stable — record what happened whenever you can.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/vet/patients/${payload.catId}`}
              className="inline-flex min-h-[56px] items-center gap-2 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isAr ? "الملف الكامل وفتح زيارة" : "Full profile & start a visit"}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
