"use client";

// ════════════════════════════════════════════════════════════════════════
//  EntryComposer — one composer, fourteen typed clinical entries
//  (MRC-VET-001 §10 "Medical records").
//
//  Why one component and not fourteen forms: a vet mid-consult should learn
//  ONE interaction and have it hold for a vaccination, a lab result and a
//  surgery. The type switch changes the FIELDS, never the grammar — the same
//  save button, the same validation voice, the same autosave-safe draft.
//
//  THE FIELDS ARE NOT DECLARED HERE. They come from `VET_ENTRY_FIELDS` in
//  @moraqat/core — the same declaration the API's validators are tested
//  against — and the payload is built by core's `buildEntryPayload`. This file
//  used to declare its own fields; they disagreed with the API on 11 of 14
//  types and stuffed a `clinicalType` key into every payload, so every single
//  save was a 400 and no clinic could write a record (audit 2026-10-04, #1).
//
//  Three things this file exists to guarantee:
//    • A prescription is BLOCKED, not warned, when the drug matches a
//      recorded allergy. Overriding demands a typed clinical justification,
//      sent BESIDE the payload and stored on the record, the prescription and
//      the audit log under the author's name.
//    • A draft author (intern, or a doctor whose licence isn't on file) is told
//      BEFORE they type that it saves as a draft (prevent > apologise, R115).
//    • Nothing is ever lost. A failed save leaves every entered value
//      untouched (R117).
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { AlertOctagon, Check, Info, Plus, X } from "lucide-react";
import { Button, Input, Badge, cn, useToast } from "@moraqat/ui";
import {
  ALLERGY_OVERRIDE_MIN_LENGTH,
  CLINICAL_ENTRY_TYPES,
  CLINICAL_ENTRY_TYPE_LABELS,
  LAB_FLAGS,
  VET_ENTRY_FIELDS,
  buildEntryPayload,
  decimalOnly,
  digitsOnly,
  licenceHoldNotice,
  requiresCoSign,
  type ClinicalEntryType,
  type EntryDraftValue,
  type LabResultDraft,
  type VetFieldSpec,
} from "@moraqat/core";
import { useLocale } from "@/app/providers";
import { AttachmentPicker } from "@/components/vet/attachment-picker";
import { VET_ENTRY_KIND_LABELS } from "@/lib/vet-wire";
import {
  useVetActor,
  useVetApi,
  vetFriendlyError,
  type EntryType,
  type MedicalAlert,
} from "@/lib/vet-api";

export type { ClinicalEntryType };

/** Every clinical kind, in the order the composer offers them. */
export const ENTRY_TYPES: readonly ClinicalEntryType[] = CLINICAL_ENTRY_TYPES;
export const ENTRY_TYPE_LABELS = CLINICAL_ENTRY_TYPE_LABELS;

/** Bilingual label for a stored entry kind, for read surfaces. */
export function entryKindLabel(kind: EntryType, isAr: boolean): string {
  // Single source: the timeline adapter derives entry titles from the same map,
  // so a kind can never be worded one way in the composer and another in the
  // record it produces.
  const e = VET_ENTRY_KIND_LABELS[kind];
  return e ? (isAr ? e.ar : e.en) : kind;
}

function isClinicalType(t: string): t is ClinicalEntryType {
  return (CLINICAL_ENTRY_TYPES as readonly string[]).includes(t);
}

// ── allergy interaction check ────────────────────────────────────────────

/**
 * Conservative two-way substring match on drug names against the recorded
 * ALLERGY alerts. Deliberately eager: a false positive costs one sentence of
 * justification, a false negative can cost the cat. The copy names the
 * recorded text rather than claiming pharmacology we don't have.
 */
export function matchAllergies(drug: string, alerts: MedicalAlert[]): MedicalAlert[] {
  const q = drug.trim().toLowerCase();
  if (q.length < 3) return [];
  return alerts
    .filter((a) => a.kind === "ALLERGY")
    .filter((a) => {
      const labels = [a.labelEn, a.labelAr].map((l) => (l ?? "").trim().toLowerCase());
      return labels.some((label) => label.length > 0 && (label.includes(q) || q.includes(label)));
    });
}

// ── values ⇄ payload ─────────────────────────────────────────────────────

type Values = Record<string, EntryDraftValue>;

/** A stored payload as composer strings — so an amendment starts from what was written. */
function valuesFromPayload(type: ClinicalEntryType, payload: Record<string, unknown> | null | undefined): Values {
  if (!payload) return {};
  const out: Values = {};
  for (const f of VET_ENTRY_FIELDS[type] as ReadonlyArray<VetFieldSpec>) {
    const v = payload[f.name];
    if (v === undefined || v === null) continue;
    if (f.kind === "labResults" && Array.isArray(v)) {
      out[f.name] = (v as Array<Record<string, unknown>>).map((r) => ({
        analyte: String(r.analyte ?? ""),
        value: String(r.value ?? ""),
        unit: r.unit ? String(r.unit) : "",
        referenceRange: r.referenceRange ? String(r.referenceRange) : "",
        flag: r.flag ? String(r.flag) : "",
      }));
    } else if (f.kind === "stringList" && Array.isArray(v)) {
      out[f.name] = v.join(", ");
    } else if (f.kind === "date" && typeof v === "string") {
      out[f.name] = v.slice(0, 10);
    } else if (f.kind === "datetime" && typeof v === "string") {
      const d = new Date(v);
      out[f.name] = Number.isNaN(d.getTime()) ? v : toLocalInput(d);
    } else {
      out[f.name] = String(v);
    }
  }
  return out;
}

/** `Date` → the value a datetime-local input expects, in the device's zone. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Is this field shown right now? (The free-text vaccine name only for "Other".) */
function visible(type: ClinicalEntryType, f: VetFieldSpec, values: Values): boolean {
  if (type === "VACCINATION" && f.name === "vaccine") {
    const code = values.vaccineCode;
    return code === "OTHER" || (typeof values.vaccine === "string" && !!values.vaccine && !code);
  }
  return true;
}

// ── the composer ─────────────────────────────────────────────────────────

export interface EntryComposerProps {
  catId: string;
  visitId?: string;
  /** The patient's alerts — powers the blocking prescription check. */
  alerts?: MedicalAlert[];
  /** Lock the composer to one type (amendments keep the original type). */
  lockedType?: ClinicalEntryType;
  /** Open on this type (still switchable). */
  initialType?: ClinicalEntryType;
  /** Prefill — e.g. the vaccination template opens a pre-filled Vaccination entry. */
  initialValues?: Record<string, string>;
  /** Amend mode targets an existing entry and creates revision n+1. */
  amendOf?: {
    entryId: string;
    type: ClinicalEntryType | EntryType;
    note?: string;
    payload?: Record<string, unknown> | null;
  };
  onSaved: (result: { id: string; isDraft: boolean }) => void;
  onCancel?: () => void;
  className?: string;
}

export function EntryComposer({
  catId,
  visitId,
  alerts = [],
  lockedType,
  initialType,
  initialValues,
  amendOf,
  onSaved,
  onCancel,
  className,
}: EntryComposerProps) {
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const L = (x: { ar: string; en: string }) => (isAr ? x.ar : x.en);
  const actor = useVetActor();
  const api = useVetApi();
  const isAmend = !!amendOf;

  const startType: ClinicalEntryType =
    (amendOf && isClinicalType(amendOf.type) ? amendOf.type : undefined) ?? lockedType ?? initialType ?? "EXAM";
  const [type, setType] = React.useState<ClinicalEntryType>(startType);
  const [values, setValues] = React.useState<Values>(() =>
    amendOf ? valuesFromPayload(startType, amendOf.payload) : { ...(initialValues ?? {}) }
  );
  const [note, setNote] = React.useState(amendOf?.note ?? "");
  const [occurredAt, setOccurredAt] = React.useState(() => toLocalInput(new Date()));
  const [amendReason, setAmendReason] = React.useState("");
  const [override, setOverride] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  // Attachments ride behind the entry (T12): picked now, uploaded once it exists.
  const [files, setFiles] = React.useState<File[]>([]);
  const formErrorRef = React.useRef<HTMLDivElement>(null);

  const fields = (VET_ENTRY_FIELDS[type] as ReadonlyArray<VetFieldSpec>).filter((f) => visible(type, f, values));
  // A null role means no clinic is chosen yet; `actor.can` already handles it.
  const savesAsDraft = actor.role ? requiresCoSign(actor.role, actor.licence ?? undefined) : false;
  const licenceNotice = actor.licence ? licenceHoldNotice(actor.licence) : null;
  const capFor = (t: ClinicalEntryType) =>
    t === "PRESCRIPTION" ? ("prescription.write" as const) : t === "LAB" || t === "IMAGING" ? ("lab.upload" as const) : null;
  const extraCap = capFor(type);
  const allowed = actor.can("record.write") && (!extraCap || actor.can(extraCap));

  // The blocking check: recomputed on every keystroke of the drug field so the
  // warning appears while typing, not at save time (R115).
  const medication = typeof values.medication === "string" ? values.medication : "";
  const allergyHits = React.useMemo(
    () => (type === "PRESCRIPTION" ? matchAllergies(medication, alerts) : []),
    [type, medication, alerts]
  );
  const blockedByAllergy = allergyHits.length > 0 && override.trim().length < ALLERGY_OVERRIDE_MIN_LENGTH;

  function set(name: string, v: EntryDraftValue) {
    setValues((prev) => ({ ...prev, [name]: v }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: "" } : prev));
  }

  /** Numbers as clinics type them: Arabic digits and «٫» become 4.2 as you type. */
  function setNumber(f: VetFieldSpec, raw: string) {
    set(f.name, f.kind === "int" ? digitsOnly(raw) : decimalOnly(raw));
  }

  function validate(): { ok: true; payload: Record<string, unknown> } | { ok: false } {
    const next: Record<string, string> = {};
    const built = buildEntryPayload(type, values);
    if (!built.ok) for (const [k, v] of Object.entries(built.errors)) next[k] = L(v);

    // An entry with no structured content and no note is not a record.
    const hasContent =
      fields.some((f) => {
        const v = values[f.name];
        return Array.isArray(v) ? v.some((r) => r.analyte.trim() || r.value.trim()) : !!v?.trim();
      }) || !!note.trim();
    if (!hasContent) {
      next.__form = isAr ? "أضف تفصيلاً واحداً على الأقل قبل الحفظ." : "Add at least one detail before saving.";
    }

    const when = new Date(occurredAt);
    if (!isAmend) {
      if (Number.isNaN(when.getTime())) {
        next.occurredAt = isAr ? "وقت غير صالح" : "That time isn't valid";
      } else if (when.getTime() > Date.now() + 60_000) {
        // A clinical record cannot describe the future.
        next.occurredAt = isAr ? "لا يمكن تسجيل حدث في المستقبل." : "A record can't be dated in the future.";
      }
    }

    if (isAmend && amendReason.trim().length < 5) {
      next.amendReason = isAr
        ? "اذكر سبب التعديل — يُحفظ مع النسخة الجديدة."
        : "Give a reason — it is stored with the new revision.";
    }

    if (allergyHits.length && override.trim().length < ALLERGY_OVERRIDE_MIN_LENGTH) {
      next.override = isAr
        ? `اكتب مبرراً سريرياً (${ALLERGY_OVERRIDE_MIN_LENGTH} أحرف على الأقل) للمتابعة رغم الحساسية المسجّلة.`
        : `Type a clinical justification (${ALLERGY_OVERRIDE_MIN_LENGTH}+ characters) to proceed despite the recorded allergy.`;
    }

    setErrors(next);
    if (Object.keys(next).length || !built.ok) {
      formErrorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return { ok: false };
    }
    return { ok: true, payload: built.payload as unknown as Record<string, unknown> };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const v = validate();
    if (!v.ok) return;
    setSaving(true);
    try {
      // The override travels BESIDE the payload, never inside it.
      const allergyOverride = allergyHits.length
        ? { matched: allergyHits.map((a) => (isAr ? a.labelAr : a.labelEn)), justification: override.trim() }
        : undefined;

      const saved = isAmend
        ? await api.reviseRecord(amendOf!.entryId, {
            payload: v.payload as never,
            note: note.trim() || undefined,
            reason: amendReason.trim(),
            allergyOverride,
          })
        : await api.createRecord({
            catId,
            visitId,
            type,
            payload: v.payload as never,
            note: note.trim() || undefined,
            occurredAt: new Date(occurredAt).toISOString(),
            allergyOverride,
          });
      const entryId = saved.entry.id;

      // The entry is saved FIRST, so a failed upload never costs the vet their
      // typing (R117); each failure is named, never silent.
      let failedUploads = 0;
      for (const f of files) {
        try {
          await api.uploadRecordAttachmentFile(entryId, f);
        } catch {
          failedUploads += 1;
        }
      }
      if (failedUploads > 0) {
        toast({
          variant: "error",
          title: isAr ? `تعذّر رفع ${failedUploads} من الملفات` : `${failedUploads} file(s) didn't upload`,
          description: isAr ? "الإدخال محفوظ — أعد إرفاق الملفات من السجل." : "The entry is saved — re-attach the files from the record.",
        });
      }
      setFiles([]);

      const isDraft = saved.coSign.required || saved.entry.status === "DRAFT";
      const effect = (saved.sideEffects as { ownerImpact?: { ar: string; en: string } }).ownerImpact;
      toast({
        variant: "success",
        title: isDraft ? (isAr ? "حُفظ كمسودة" : "Saved as a draft") : isAr ? "أُضيف للسجل" : "Added to the record",
        description: isDraft
          ? saved.coSign.notice
            ? L(saved.coSign.notice)
            : isAr
              ? "ينتظر توقيع طبيب بيطري ليصبح نهائياً."
              : "It waits on a veterinarian's co-signature to become final."
          : effect
            ? L(effect)
            : isAr
              ? "السجل يُضاف ولا يُستبدل — يبقى هذا الإدخال دائماً."
              : "The record appends, never overwrites — this entry is permanent.",
      });
      onSaved({ id: entryId, isDraft });
    } catch (err) {
      const f = vetFriendlyError(err, isAr);
      // Values are deliberately NOT cleared — a failed save must never cost a
      // vet their typing (R117).
      setErrors({ __form: f.message });
      toast({ variant: "error", title: f.title, description: f.message });
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <div className={cn("rounded-2xl border border-border bg-muted/50 p-5", className)}>
        <p className="text-sm font-medium text-foreground">
          {type === "PRESCRIPTION" && licenceNotice
            ? isAr
              ? "الوصفات موقوفة حتى يُسجَّل ترخيصك."
              : "Prescribing is held until your licence is on file."
            : isAr
              ? "دورك لا يشمل تدوين هذا النوع."
              : "Your role doesn't include writing this entry type."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {type === "PRESCRIPTION" && licenceNotice
            ? L(licenceNotice)
            : isAr
              ? "مدير العيادة يستطيع تنفيذه أو تعديل دورك."
              : "A clinic manager can do it for you, or change your role."}
        </p>
      </div>
    );
  }

  const inputClass = (err?: string) =>
    cn(
      "mt-1 w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-foreground shadow-e1 outline-none",
      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      err ? "border-destructive/60" : "border-input"
    );

  return (
    <form onSubmit={submit} noValidate className={cn("rounded-2xl border border-border bg-card p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-semibold tracking-tight">
          {isAmend ? (isAr ? "تعديل الإدخال" : "Amend entry") : isAr ? "إدخال سريري جديد" : "New clinical entry"}
        </h3>
        {isAmend && <Badge variant="warning">{isAr ? "ينشئ نسخة جديدة" : "Creates a new revision"}</Badge>}
        {savesAsDraft && (
          <Badge variant="info">{isAr ? "يُحفظ كمسودة — يحتاج توقيعاً" : "Saves as draft — needs co-sign"}</Badge>
        )}
      </div>

      {isAmend && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {isAr
            ? "الإدخال الأصلي يبقى مقروءاً في السجل. هذا التعديل يُضاف فوقه كنسخة جديدة موقّعة باسمك."
            : "The original entry stays readable in the record. This amendment is appended above it as a new revision, signed with your name."}
        </p>
      )}

      {/* Type switcher — hidden when amending (a revision keeps its type). */}
      {!isAmend && !lockedType && (
        <fieldset className="mt-4">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isAr ? "النوع" : "Type"}
          </legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ENTRY_TYPES.map((t) => {
              const cap = capFor(t);
              if (cap && !actor.can(cap)) return null;
              const active = t === type;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setType(t);
                    setErrors({});
                  }}
                  className={cn(
                    "min-h-[44px] rounded-full border px-3.5 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {L(ENTRY_TYPE_LABELS[t])}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Structured fields for the chosen type — straight from the contract. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const id = `entry-${type}-${f.name}`;
          const err = errors[f.name];
          const hint = f.hint ? L(f.hint) : undefined;
          const describedBy = err ? `${id}-err` : hint ? `${id}-hint` : undefined;
          const raw = values[f.name];
          const text = typeof raw === "string" ? raw : "";
          const required = f.required || f.uiRequired;
          return (
            <div key={f.name} className={cn(f.half ? "sm:col-span-1" : "sm:col-span-2")}>
              <label htmlFor={id} className="block text-xs font-medium text-foreground">
                {L(f.label)}
                {required && (
                  <span className="ms-1 text-destructive" aria-hidden>
                    *
                  </span>
                )}
              </label>
              {f.kind === "textarea" ? (
                <textarea
                  id={id}
                  rows={f.rows ?? 3}
                  value={text}
                  maxLength={f.maxLength}
                  onChange={(e) => set(f.name, e.target.value)}
                  aria-invalid={!!err || undefined}
                  aria-required={required || undefined}
                  aria-describedby={describedBy}
                  className={inputClass(err)}
                />
              ) : f.kind === "enum" || (f.kind === "int" && f.options?.length) ? (
                <select
                  id={id}
                  value={text}
                  onChange={(e) => set(f.name, e.target.value)}
                  aria-invalid={!!err || undefined}
                  aria-required={required || undefined}
                  aria-describedby={describedBy}
                  className={cn(inputClass(err), "h-11 px-3 py-0")}
                >
                  <option value="">{isAr ? "اختر…" : "Choose…"}</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {L(o)}
                    </option>
                  ))}
                </select>
              ) : f.kind === "labResults" ? (
                <LabResultsEditor
                  id={id}
                  rows={Array.isArray(raw) ? raw : []}
                  onChange={(rows) => set(f.name, rows)}
                  isAr={isAr}
                  invalid={!!err}
                />
              ) : f.kind === "int" || f.kind === "decimal" ? (
                // type="text" + inputMode: a type="number" field silently drops
                // Arabic-Indic digits and «٫» — the keyboard every Arabic
                // clinic uses (R101, R115).
                <Input
                  id={id}
                  type="text"
                  inputMode={f.kind === "int" ? "numeric" : "decimal"}
                  dir="ltr"
                  value={text}
                  onChange={(e) => setNumber(f, e.target.value)}
                  invalid={!!err}
                  aria-required={required || undefined}
                  aria-describedby={describedBy}
                  className="mt-1 tabular-nums"
                />
              ) : (
                <Input
                  id={id}
                  type={f.kind === "date" ? "date" : f.kind === "datetime" ? "datetime-local" : "text"}
                  value={text}
                  maxLength={f.kind === "text" ? f.maxLength : undefined}
                  onChange={(e) => set(f.name, e.target.value)}
                  invalid={!!err}
                  aria-required={required || undefined}
                  aria-describedby={describedBy}
                  className="mt-1"
                />
              )}
              {err ? (
                <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-destructive">
                  {err}
                </p>
              ) : hint ? (
                <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
                  {hint}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* The blocking allergy interaction check. */}
      {allergyHits.length > 0 && (
        <div role="alert" className="mt-4 rounded-2xl border-2 border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertOctagon className="size-5 shrink-0" aria-hidden />
            <p className="text-sm font-semibold">
              {isAr ? "حساسية مسجّلة تطابق هذا الدواء" : "Recorded allergy matches this drug"}
            </p>
          </div>
          <ul className="mt-2 space-y-1">
            {allergyHits.map((a) => (
              <li key={a.id} className="text-sm font-medium text-destructive">
                • {isAr ? a.labelAr : a.labelEn}
              </li>
            ))}
          </ul>
          <label htmlFor="allergy-override" className="mt-3 block text-xs font-medium text-foreground">
            {isAr
              ? "المبرر السريري للمتابعة (يُحفظ باسمك على الوصفة وفي سجل التدقيق)"
              : "Clinical justification to proceed (stored on the prescription and the audit log, under your name)"}
          </label>
          <textarea
            id="allergy-override"
            rows={2}
            value={override}
            onChange={(e) => {
              setOverride(e.target.value);
              setErrors((p) => (p.override ? { ...p, override: "" } : p));
            }}
            aria-invalid={!!errors.override || undefined}
            aria-describedby={errors.override ? "allergy-override-err" : undefined}
            className="mt-1 w-full rounded-xl border border-destructive/50 bg-background px-4 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          {errors.override && (
            <p id="allergy-override-err" className="mt-1 text-xs font-medium text-destructive">
              {errors.override}
            </p>
          )}
        </div>
      )}

      {/* Free-text note + when it happened. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="entry-note" className="block text-xs font-medium text-foreground">
            {isAr ? "ملاحظة" : "Note"}
          </label>
          <textarea
            id="entry-note"
            rows={2}
            value={note}
            maxLength={4000}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass()}
          />
        </div>
        {!isAmend && (
          <div>
            <label htmlFor="entry-when" className="block text-xs font-medium text-foreground">
              {isAr ? "وقت الحدث" : "When it happened"}
            </label>
            <Input
              id="entry-when"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => {
                setOccurredAt(e.target.value);
                setErrors((p) => (p.occurredAt ? { ...p, occurredAt: "" } : p));
              }}
              invalid={!!errors.occurredAt}
              aria-describedby={errors.occurredAt ? "entry-when-err" : undefined}
              className="mt-1"
            />
            {errors.occurredAt && (
              <p id="entry-when-err" role="alert" className="mt-1 text-xs text-destructive">
                {errors.occurredAt}
              </p>
            )}
          </div>
        )}

        {isAmend && (
          <div>
            <label htmlFor="amend-reason" className="block text-xs font-medium text-foreground">
              {isAr ? "سبب التعديل" : "Reason for the amendment"}
              <span className="ms-1 text-destructive" aria-hidden>
                *
              </span>
            </label>
            <Input
              id="amend-reason"
              value={amendReason}
              maxLength={500}
              onChange={(e) => {
                setAmendReason(e.target.value);
                setErrors((p) => (p.amendReason ? { ...p, amendReason: "" } : p));
              }}
              invalid={!!errors.amendReason}
              aria-describedby={errors.amendReason ? "amend-reason-err" : undefined}
              className="mt-1"
            />
            {errors.amendReason && (
              <p id="amend-reason-err" role="alert" className="mt-1 text-xs text-destructive">
                {errors.amendReason}
              </p>
            )}
          </div>
        )}
      </div>

      <div ref={formErrorRef}>
        {errors.__form && (
          <div role="alert" className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive">{errors.__form}</p>
          </div>
        )}
      </div>

      {savesAsDraft && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-px size-4 shrink-0" aria-hidden />
          {licenceNotice
            ? L(licenceNotice)
            : isAr
              ? "ما تكتبه يُحفظ كمسودة موقّعة باسمك، ولا يصبح جزءاً نهائياً من السجل حتى يوقّعه طبيب بيطري. لا شيء يُفقد في الانتظار."
              : "What you write is saved as a draft under your name, and becomes a final part of the record once a veterinarian co-signs it. Nothing is lost while it waits."}
        </p>
      )}

      {!isAmend && actor.can("attachment.upload") && (
        <AttachmentPicker files={files} onChange={setFiles} isAr={isAr} className="mt-4" />
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="submit" variant="primary" loading={saving} disabled={blockedByAllergy}>
          {!saving && <Check className="size-4" />}
          {isAmend
            ? isAr
              ? "احفظ النسخة الجديدة"
              : "Save the revision"
            : savesAsDraft
              ? isAr
                ? "احفظ كمسودة"
                : "Save as draft"
              : isAr
                ? "أضف للسجل"
                : "Add to the record"}
        </Button>
        {onCancel && (
          <Button type="button" variant="tertiary" onClick={onCancel} disabled={saving}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
        )}
        {blockedByAllergy && (
          <p className="w-full text-xs font-medium text-destructive">
            {isAr ? "الحفظ موقوف حتى تكتب المبرر السريري أعلاه." : "Saving is held until you write the clinical justification above."}
          </p>
        )}
      </div>
    </form>
  );
}

// ── lab results ──────────────────────────────────────────────────────────

const FLAG_LABELS: Record<(typeof LAB_FLAGS)[number], { ar: string; en: string }> = {
  LOW: { ar: "منخفض", en: "Low" },
  NORMAL: { ar: "طبيعي", en: "Normal" },
  HIGH: { ar: "مرتفع", en: "High" },
  ABNORMAL: { ar: "غير طبيعي", en: "Abnormal" },
};

/** Rows of analyte · value · unit · flag. Values keep what was typed (Arabic digits become Latin). */
function LabResultsEditor({
  id,
  rows,
  onChange,
  isAr,
  invalid,
}: {
  id: string;
  rows: LabResultDraft[];
  onChange: (rows: LabResultDraft[]) => void;
  isAr: boolean;
  invalid?: boolean;
}) {
  const list = rows.length ? rows : [{ analyte: "", value: "", unit: "", flag: "" }];
  const update = (i: number, patch: Partial<LabResultDraft>) =>
    onChange(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const cell =
    "h-11 min-w-0 rounded-xl border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div id={id} className="mt-1 space-y-2" role="group">
      {list.map((r, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_1fr_0.8fr_1fr_auto]">
          <input
            aria-label={isAr ? "الفحص" : "Analyte"}
            placeholder={isAr ? "الفحص" : "Analyte"}
            value={r.analyte}
            onChange={(e) => update(i, { analyte: e.target.value })}
            className={cn(cell, invalid ? "border-destructive/60" : "border-input")}
          />
          <input
            aria-label={isAr ? "القيمة" : "Value"}
            placeholder={isAr ? "القيمة" : "Value"}
            inputMode="decimal"
            dir="ltr"
            value={r.value}
            onChange={(e) => update(i, { value: e.target.value })}
            className={cn(cell, "tabular-nums", invalid ? "border-destructive/60" : "border-input")}
          />
          <input
            aria-label={isAr ? "الوحدة" : "Unit"}
            placeholder={isAr ? "الوحدة" : "Unit"}
            dir="ltr"
            value={r.unit ?? ""}
            onChange={(e) => update(i, { unit: e.target.value })}
            className={cn(cell, "border-input")}
          />
          <select
            aria-label={isAr ? "التقييم" : "Flag"}
            value={r.flag ?? ""}
            onChange={(e) => update(i, { flag: e.target.value })}
            className={cn(cell, "border-input")}
          >
            <option value="">{isAr ? "—" : "—"}</option>
            {LAB_FLAGS.map((f) => (
              <option key={f} value={f}>
                {isAr ? FLAG_LABELS[f].ar : FLAG_LABELS[f].en}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onChange(list.filter((_, j) => j !== i))}
            aria-label={isAr ? "احذف هذه النتيجة" : "Remove this result"}
            className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="tertiary"
        onClick={() => onChange([...list, { analyte: "", value: "", unit: "", flag: "" }])}
      >
        <Plus className="size-4" />
        {isAr ? "نتيجة أخرى" : "Another result"}
      </Button>
    </div>
  );
}
