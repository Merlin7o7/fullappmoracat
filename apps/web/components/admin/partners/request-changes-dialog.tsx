"use client";

/**
 * Request changes — send a registration back with a note and the exact
 * sections the owner may reopen. Everything else stays locked, so the clinic
 * fixes what was asked and nothing drifts (MRC-VET-002 §Review).
 */

import * as React from "react";
import { Button, Dialog, cn } from "@moraqat/ui";
import { REOPENABLE_STEPS, REGISTRATION_STEPS, type RegistrationGap, type RegistrationStep } from "@moraqat/core";
import { fieldClass } from "./shared";

export function RequestChangesDialog({
  open,
  onClose,
  onSubmit,
  pending,
  gaps,
  isAr,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { note: string; steps: RegistrationStep[] }) => void;
  pending: boolean;
  /** Pre-select the steps that currently have gaps — the likeliest reason to send it back. */
  gaps: RegistrationGap[];
  isAr: boolean;
}) {
  const [note, setNote] = React.useState("");
  const [steps, setSteps] = React.useState<RegistrationStep[]>([]);
  const [tried, setTried] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setNote("");
    setTried(false);
    const gapSteps = Array.from(new Set(gaps.map((g) => g.step))).filter((s) => REOPENABLE_STEPS.includes(s));
    setSteps(gapSteps);
    // Only on open; gaps changing underneath shouldn't wipe the reviewer's choices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const noteError = note.trim().length < 5;
  const stepsError = steps.length === 0;

  const toggle = (s: RegistrationStep) =>
    setSteps((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const submit = () => {
    setTried(true);
    if (noteError || stepsError) return;
    // Keep the lifecycle order regardless of click order.
    onSubmit({ note: note.trim(), steps: REOPENABLE_STEPS.filter((s) => steps.includes(s)) });
  };

  return (
    <Dialog
      open={open}
      onClose={pending ? () => {} : onClose}
      title={isAr ? "طلب تعديلات" : "Request changes"}
      description={
        isAr
          ? "يصل المالك بريد بملاحظتك، وتُفتح الأقسام المحددة فقط للتعديل. اكتب بوضوح ما المطلوب بالضبط."
          : "The owner is emailed your note, and only the sections you tick reopen for editing. Say exactly what needs fixing."
      }
      className="max-w-lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button size="sm" onClick={submit} loading={pending}>
            {isAr ? "إرسال طلب التعديلات" : "Send change request"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="changes-note" className="mb-1.5 block text-sm font-medium">
            {isAr ? "ملاحظة للعيادة" : "Note to the clinic"}
            <span className="sr-only">{isAr ? " (مطلوب)" : " (required)"}</span>
          </label>
          <textarea
            id="changes-note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            disabled={pending}
            aria-invalid={(tried && noteError) || undefined}
            aria-describedby={tried && noteError ? "changes-note-error" : undefined}
            placeholder={
              isAr
                ? "مثال: صورة ترخيص فرع العليا غير واضحة — ارفع نسخة أوضح."
                : "e.g. The Olaya branch licence scan is unreadable — upload a clearer copy."
            }
            className={cn(fieldClass, "resize-none py-2", tried && noteError && "border-destructive/60")}
          />
          {tried && noteError && (
            <p id="changes-note-error" className="mt-1 text-xs font-medium text-destructive">
              {isAr ? "اكتب ملاحظة من ٥ أحرف على الأقل." : "Write a note of at least 5 characters."}
            </p>
          )}
        </div>

        <fieldset aria-describedby={tried && stepsError ? "changes-steps-error" : undefined}>
          <legend className="mb-1.5 text-sm font-medium">{isAr ? "الأقسام التي تُفتح للتعديل" : "Sections to reopen"}</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {REOPENABLE_STEPS.map((s) => {
              const meta = REGISTRATION_STEPS.find((x) => x.key === s);
              const checked = steps.includes(s);
              return (
                <label
                  key={s}
                  className={cn(
                    "flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm transition-colors",
                    checked ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(s)}
                    disabled={pending}
                    className="size-4 accent-[hsl(var(--primary))]"
                  />
                  {meta ? (isAr ? meta.ar : meta.en) : s}
                </label>
              );
            })}
          </div>
          {tried && stepsError && (
            <p id="changes-steps-error" className="mt-1 text-xs font-medium text-destructive">
              {isAr ? "اختر قسماً واحداً على الأقل." : "Choose at least one section."}
            </p>
          )}
        </fieldset>
      </div>
    </Dialog>
  );
}
