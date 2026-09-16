"use client";

/**
 * Step 4 — the paperwork, one slot per document. Every upload saves on its
 * own the moment it lands, so a clinic manager can photograph the CR now and
 * come back for the licence tomorrow without losing either (R117).
 *
 * The number and expiry sent with each file are pre-filled from what was typed
 * in the earlier steps — nobody should type a CR number twice (R002).
 */

import * as React from "react";
import { Eye, FileText, Loader2, Lock, RefreshCw, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, cn } from "@moraqat/ui";
import {
  CLINIC_DOCUMENT_LABELS,
  CLINIC_DOCUMENT_MAX_BYTES,
  CLINIC_DOCUMENT_MIME_TYPES,
  REGISTRATION_STEPS,
  type ClinicDocumentKind,
} from "@moraqat/core";
import {
  formatBytes,
  openPrivateDocument,
  registrationError,
  toDateInput,
  type RegDocument,
  type RegFriendlyError,
  type RegistrationApi,
  type RegistrationState,
} from "@/lib/vet-registration";
import { ActionBar, ConfirmDialog, ErrorNote, FormSection, Notice, StepHeader, formatDate } from "./ui";
import type { StepProps } from "./types";

type UploadKind = Exclude<ClinicDocumentKind, "PRACTITIONER_LICENCE">;

const EXT_OK = /\.(pdf|jpe?g|png)$/i;

function checkFile(file: File, isAr: boolean): RegFriendlyError | null {
  const typeOk = (CLINIC_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type) || (!file.type && EXT_OK.test(file.name));
  if (!typeOk) {
    return isAr
      ? { title: "نوع الملف غير مدعوم", message: "ارفع ملف PDF أو صورة JPG أو PNG." }
      : { title: "File type not supported", message: "Upload a PDF, or a JPG or PNG photo." };
  }
  if (file.size > CLINIC_DOCUMENT_MAX_BYTES) {
    return isAr
      ? { title: "الملف كبير", message: `حجمه ${formatBytes(file.size, true)} والحد ١٠ م.ب. صوّره بجودة أقل أو احفظه PDF.` }
      : { title: "File too large", message: `It's ${formatBytes(file.size, false)} and the limit is 10 MB. Photograph it at lower quality or save it as a PDF.` };
  }
  return null;
}

export function StepDocuments({ orgId, state, api, isAr, onState, onNext, onBack, goTo }: StepProps) {
  const meta = REGISTRATION_STEPS.find((s) => s.key === "documents")!;
  const docs = state.documents;
  const orgDoc = (kind: UploadKind) => docs.find((d) => d.kind === kind && !d.branchId);
  const others = docs.filter((d) => d.kind === "OTHER");
  const missingRequired = state.gaps.filter((g) => g.step === "documents").length;

  return (
    <div className="flex flex-col gap-5">
      <StepHeader title={isAr ? meta.ar : meta.en} hint={isAr ? meta.hintAr : meta.hintEn} />

      <Notice tone="info" title={isAr ? "مستنداتك محفوظة بسرية" : "Your documents are stored privately"}>
        {isAr
          ? "لا تُنشر ولا تظهر في الدليل. يطّلع عليها فريق المراجعة في مرقط فقط للتحقق من العيادة. PDF أو JPG أو PNG، حتى ١٠ م.ب لكل ملف."
          : "They're never published or shown in the directory. Only Moracat's review team sees them, to verify the clinic. PDF, JPG or PNG, up to 10 MB each."}
      </Notice>

      <FormSection title={isAr ? "مطلوبة" : "Required"}>
        <DocSlot
          orgId={orgId}
          api={api}
          isAr={isAr}
          onState={onState}
          kind="CR"
          required
          doc={orgDoc("CR")}
          title={isAr ? CLINIC_DOCUMENT_LABELS.CR.ar : CLINIC_DOCUMENT_LABELS.CR.en}
          defaults={{ number: state.org.crNumber ?? "", expiresAt: toDateInput(state.org.crExpiresAt) }}
        />
        {state.branches.length === 0 ? (
          <Notice
            tone="warning"
            title={isAr ? "ترخيص وزارة البيئة لكل فرع" : "A MEWA licence for each branch"}
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => goTo("branches")}>
                {isAr ? "أضف الفروع" : "Add branches"}
              </Button>
            }
          >
            {isAr ? "احفظ الفروع أولاً — ثم ترفع ترخيص كل فرع هنا." : "Save your branches first — then upload each branch's licence here."}
          </Notice>
        ) : (
          state.branches.map((b) => (
            <DocSlot
              key={b.id}
              orgId={orgId}
              api={api}
              isAr={isAr}
              onState={onState}
              kind="MEWA_LICENCE"
              branchId={b.id}
              required
              doc={docs.find((d) => d.kind === "MEWA_LICENCE" && d.branchId === b.id)}
              title={isAr ? CLINIC_DOCUMENT_LABELS.MEWA_LICENCE.ar : CLINIC_DOCUMENT_LABELS.MEWA_LICENCE.en}
              subtitle={isAr ? b.nameAr : b.nameEn || b.nameAr}
              defaults={{ number: b.licenceNo ?? "", expiresAt: toDateInput(b.licenceExpiresAt) }}
            />
          ))
        )}
      </FormSection>

      <FormSection
        title={isAr ? "اختيارية" : "Optional"}
        description={isAr ? "تسرّع المراجعة إن توفّرت." : "They speed up the review if you have them."}
      >
        <DocSlot
          orgId={orgId}
          api={api}
          isAr={isAr}
          onState={onState}
          kind="VAT"
          doc={orgDoc("VAT")}
          title={isAr ? CLINIC_DOCUMENT_LABELS.VAT.ar : CLINIC_DOCUMENT_LABELS.VAT.en}
          defaults={{ number: state.org.vatNumber ?? "", expiresAt: "" }}
        />
        <DocSlot
          orgId={orgId}
          api={api}
          isAr={isAr}
          onState={onState}
          kind="INSURANCE"
          doc={orgDoc("INSURANCE")}
          title={isAr ? CLINIC_DOCUMENT_LABELS.INSURANCE.ar : CLINIC_DOCUMENT_LABELS.INSURANCE.en}
          defaults={{ number: "", expiresAt: "" }}
        />
        {others.map((d) => (
          <DocSlot
            key={d.id}
            orgId={orgId}
            api={api}
            isAr={isAr}
            onState={onState}
            kind="OTHER"
            doc={d}
            title={isAr ? CLINIC_DOCUMENT_LABELS.OTHER.ar : CLINIC_DOCUMENT_LABELS.OTHER.en}
            defaults={{ number: "", expiresAt: "" }}
          />
        ))}
        <DocSlot
          key={`other-new-${others.length}`}
          orgId={orgId}
          api={api}
          isAr={isAr}
          onState={onState}
          kind="OTHER"
          title={others.length ? (isAr ? "مستند آخر إضافي" : "Another document") : isAr ? CLINIC_DOCUMENT_LABELS.OTHER.ar : CLINIC_DOCUMENT_LABELS.OTHER.en}
          subtitle={isAr ? "مثل شهادة البلدية أو الدفاع المدني." : "For example a municipality or civil defence certificate."}
          defaults={{ number: "", expiresAt: "" }}
        />
      </FormSection>

      <ActionBar
        isAr={isAr}
        onBack={onBack}
        onPrimary={onNext}
        primaryLabel={isAr ? "متابعة" : "Continue"}
        note={
          missingRequired > 0
            ? isAr
              ? `بقي ${missingRequired} من المستندات المطلوبة — تقدر تكملها لاحقاً قبل الإرسال.`
              : `${missingRequired} required document${missingRequired === 1 ? "" : "s"} still to upload — you can finish before submitting.`
            : undefined
        }
      />
    </div>
  );
}

function DocSlot({
  orgId,
  api,
  isAr,
  onState,
  kind,
  branchId,
  doc,
  required,
  title,
  subtitle,
  defaults,
}: {
  orgId: string;
  api: RegistrationApi;
  isAr: boolean;
  onState: (s: RegistrationState) => void;
  kind: UploadKind;
  branchId?: string;
  doc?: RegDocument;
  required?: boolean;
  title: string;
  subtitle?: string;
  defaults: { number: string; expiresAt: string };
}) {
  const id = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [number, setNumber] = React.useState(doc?.number ?? defaults.number);
  const [expiresAt, setExpiresAt] = React.useState(toDateInput(doc?.expiresAt) || defaults.expiresAt);
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<RegFriendlyError | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [viewing, setViewing] = React.useState(false);

  async function onFile(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError(null);
    const problem = checkFile(file, isAr);
    if (problem) {
      setError(problem);
      return;
    }
    setPending(file.name);
    try {
      const next = await api.uploadDocument(orgId, {
        file,
        kind,
        branchId,
        number: number.trim() || undefined,
        expiresAt: expiresAt || undefined,
      });
      onState(next);
    } catch (err) {
      setError(registrationError(err, isAr));
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    if (!doc) return;
    setDeleting(true);
    setError(null);
    try {
      onState(await api.deleteDocument(orgId, doc.id));
      setConfirmDelete(false);
    } catch (err) {
      setConfirmDelete(false);
      setError(registrationError(err, isAr));
    } finally {
      setDeleting(false);
    }
  }

  async function view() {
    if (!doc) return;
    setViewing(true);
    setError(null);
    try {
      await openPrivateDocument(() => api.ownerDocumentBlob(orgId, doc.id));
    } catch (err) {
      setError(registrationError(err, isAr));
    } finally {
      setViewing(false);
    }
  }

  const done = !!doc;

  return (
    <Card className={cn("flex flex-col gap-3 p-4", required && !done && "border-warning/40")}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            done ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"
          )}
          aria-hidden
        >
          <FileText className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 id={`${id}-t`} className="text-sm font-semibold">
              {title}
            </h4>
            {required && !done && <Badge variant="warning">{isAr ? "مطلوب" : "Required"}</Badge>}
            {done && (
              <Badge variant={doc.verified ? "success" : "secondary"} dot>
                {doc.verified ? (isAr ? "تم التحقق" : "Verified") : isAr ? "مرفوع" : "Uploaded"}
              </Badge>
            )}
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          {doc && (
            <p className="mt-1 break-all text-xs text-muted-foreground">
              <span dir="ltr" className="font-medium text-foreground">
                {doc.fileName ?? "—"}
              </span>
              {" · "}
              {formatBytes(doc.sizeBytes, isAr)}
              {" · "}
              {isAr ? `رُفع ${formatDate(doc.createdAt, true)}` : `uploaded ${formatDate(doc.createdAt, false)}`}
              {doc.number && (
                <>
                  {" · "}
                  {isAr ? "رقم " : "No. "}
                  <span dir="ltr">{doc.number}</span>
                </>
              )}
              {doc.expiresAt && (
                <>
                  {" · "}
                  {isAr ? `ينتهي ${formatDate(doc.expiresAt, true)}` : `expires ${formatDate(doc.expiresAt, false)}`}
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <details className="group rounded-xl bg-muted/40 px-3 text-xs">
        <summary className="flex min-h-[44px] cursor-pointer items-center font-medium text-muted-foreground marker:content-none hover:text-foreground">
          {isAr ? "رقم المستند وتاريخ انتهائه (اختياري) — يُرسلان مع الملف" : "Document number and expiry (optional) — sent with the file"}
        </summary>
        <div className="grid gap-3 pb-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-n`} className="font-medium">
              {isAr ? "رقم المستند" : "Document number"}
            </label>
            <input
              id={`${id}-n`}
              dir="ltr"
              value={number}
              maxLength={60}
              onChange={(e) => setNumber(e.target.value)}
              className="h-11 rounded-lg border border-input bg-background px-3 text-sm tabular focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-e`} className="font-medium">
              {isAr ? "تاريخ الانتهاء" : "Expiry date"}
            </label>
            <input
              id={`${id}-e`}
              type="date"
              dir="ltr"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="h-11 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {doc && (
            <p className="text-muted-foreground sm:col-span-2">
              {isAr ? "لتغيير هذه البيانات لملف مرفوع، استبدل الملف." : "To change these for an uploaded file, replace the file."}
            </p>
          )}
        </div>
      </details>

      <input
        ref={inputRef}
        id={`${id}-f`}
        type="file"
        accept={CLINIC_DOCUMENT_MIME_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-labelledby={`${id}-t`}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />

      {pending ? (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-primary/[0.06] px-3 py-3 text-xs">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
          <span>
            {isAr ? "نرفع " : "Uploading "}
            <span dir="ltr" className="font-medium">
              {pending}
            </span>
            …
          </span>
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {doc ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => void view()} loading={viewing}>
                {!viewing && <Eye aria-hidden />}
                {isAr ? "عرض" : "View"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                <RefreshCw aria-hidden />
                {isAr ? "استبدال" : "Replace"}
              </Button>
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden />
                {isAr ? "حذف" : "Remove"}
              </Button>
            </>
          ) : (
            <Button type="button" variant={required ? "brand" : "outline"} size="sm" onClick={() => inputRef.current?.click()}>
              <Upload aria-hidden />
              {isAr ? "ارفع الملف" : "Upload file"}
            </Button>
          )}
          <span className="ms-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="size-3" aria-hidden />
            {isAr ? "خاص" : "Private"}
          </span>
        </div>
      )}

      <ErrorNote error={error} />

      <ConfirmDialog
        open={confirmDelete}
        isAr={isAr}
        busy={deleting}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        title={isAr ? "حذف هذا المستند؟" : "Remove this document?"}
        description={
          required
            ? isAr
              ? "هذا مستند مطلوب — ستحتاج رفع نسخة قبل إرسال الطلب."
              : "This document is required — you'll need to upload a copy before you can submit."
            : isAr
              ? "يُحذف الملف من طلبك."
              : "The file is removed from your registration."
        }
        confirmLabel={isAr ? "حذف" : "Remove"}
      />
    </Card>
  );
}
