"use client";

/**
 * Form primitives for the clinic registration wizard (MRC-VET-002).
 *
 * The shared `components/field.tsx` is deliberately small; registration needs
 * a little more — `dir="ltr"` on numbers inside an RTL page (R101), optional
 * markers, character limits, and errors wired to aria-describedby so a screen
 * reader hears *why* a field is wrong, not just that it is (R084).
 */

import * as React from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Info, RotateCcw, TriangleAlert } from "lucide-react";
import { Button, Dialog, Input, cn } from "@moraqat/ui";
import type { RegFriendlyError } from "@/lib/vet-registration";

/* ── Formatting ─────────────────────────────────────────────────────────── */

export function formatDate(iso: string | null | undefined, isAr: boolean): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { dateStyle: "medium" }).format(d);
}

/** "YYYY-MM-DD" (or ISO) is on or before today. */
export function isPastDate(value: string | null | undefined): boolean {
  if (!value) return false;
  const d = new Date(value.length === 10 ? `${value}T23:59:59` : value);
  return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now();
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── Fields ─────────────────────────────────────────────────────────────── */

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  isAr: boolean;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

function FieldShell({ id, label, required, optional, isAr, hint, error, className, children }: FieldShellProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-sm font-medium">
        <span>{label}</span>
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
        {optional && (
          <span className="text-xs font-normal text-muted-foreground">{isAr ? "(اختياري)" : "(optional)"}</span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="flex items-start gap-1.5 text-xs leading-relaxed text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isAr: boolean;
  required?: boolean;
  optional?: boolean;
  hint?: React.ReactNode;
  error?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  dir?: "ltr" | "rtl" | "auto";
  placeholder?: string;
  maxLength?: number;
  readOnly?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  className?: string;
  inputClassName?: string;
  /** Anchor for "jump to the first error". */
  fieldName?: string;
}

export function TextField({
  label,
  value,
  onChange,
  isAr,
  required,
  optional,
  hint,
  error,
  type = "text",
  inputMode,
  autoComplete,
  dir,
  placeholder,
  maxLength,
  readOnly,
  autoFocus,
  onBlur,
  className,
  inputClassName,
  fieldName,
}: TextFieldProps) {
  const id = React.useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <FieldShell id={id} label={label} required={required} optional={optional} isAr={isAr} hint={hint} error={error} className={className}>
      <Input
        id={id}
        name={fieldName}
        data-field={fieldName}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        required={required}
        aria-required={required || undefined}
        invalid={!!error}
        aria-describedby={describedBy}
        inputMode={inputMode}
        autoComplete={autoComplete}
        dir={dir}
        placeholder={placeholder}
        maxLength={maxLength}
        readOnly={readOnly}
        autoFocus={autoFocus}
        className={cn(
          dir === "ltr" && "text-start [unicode-bidi:plaintext]",
          readOnly && "bg-muted/60 text-muted-foreground",
          inputClassName
        )}
      />
    </FieldShell>
  );
}

export interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  isAr: boolean;
  required?: boolean;
  placeholder?: string;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  fieldName?: string;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  isAr,
  required,
  placeholder,
  hint,
  error,
  className,
  fieldName,
}: SelectFieldProps) {
  const id = React.useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <FieldShell id={id} label={label} required={required} isAr={isAr} hint={hint} error={error} className={className}>
      <select
        id={id}
        name={fieldName}
        data-field={fieldName}
        value={value}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 w-full rounded-xl border bg-background px-3 text-sm shadow-e1 outline-none transition-shadow",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          error ? "border-destructive/60" : "border-input",
          !value && "text-muted-foreground"
        )}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-4 rounded-xl border border-border px-3 py-2.5">
      <span className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium">
          {label}
        </label>
        {description && (
          <span id={`${id}-d`} className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          checked ? "bg-primary" : "bg-muted-foreground/30"
        )}
      >
        {/* 44px hit area around a 28px track */}
        <span className="absolute -inset-2" aria-hidden />
        <span
          aria-hidden
          className={cn(
            "inline-block size-5 rounded-full bg-background shadow-e1 transition-transform",
            checked ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1"
          )}
        />
      </button>
    </div>
  );
}

export function CheckRow({
  checked,
  onChange,
  children,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm leading-relaxed transition-colors",
        "focus-within:ring-2 focus-within:ring-ring",
        checked ? "border-primary/40 bg-primary/[0.06]" : "border-border hover:bg-muted",
        className
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[hsl(var(--primary))]"
      />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

/* ── Messages ───────────────────────────────────────────────────────────── */

export function ErrorNote({ error, className }: { error: RegFriendlyError | null; className?: string }) {
  if (!error) return null;
  return (
    <div role="alert" className={cn("rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5", className)}>
      <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
        <AlertCircle className="size-4 shrink-0" aria-hidden />
        {error.title}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{error.message}</p>
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  className,
  action,
}: {
  tone?: "info" | "warning" | "success";
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const Icon = tone === "warning" ? TriangleAlert : tone === "success" ? CheckCircle2 : Info;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm",
        tone === "warning" && "border-warning/40 bg-warning/[0.08]",
        tone === "success" && "border-success/30 bg-success/[0.07]",
        tone === "info" && "border-info/25 bg-info/[0.06]",
        className
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "warning" && "text-[hsl(38_92%_32%)] dark:text-warning-ink",
          tone === "success" && "text-success",
          tone === "info" && "text-info"
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium leading-snug">{title}</p>}
        {children && <div className={cn("text-xs leading-relaxed text-muted-foreground", title && "mt-0.5")}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

export function RestoredDraftNote({ isAr, onDiscard }: { isAr: boolean; onDiscard: () => void }) {
  return (
    <Notice
      tone="info"
      title={isAr ? "أعدنا ما كتبته سابقاً" : "We kept what you typed"}
      action={
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          {isAr ? "تجاهل المسودة والعودة لآخر نسخة محفوظة" : "Discard the draft and use the last saved version"}
        </button>
      }
    >
      {isAr ? "هذه التعديلات لم تُحفظ بعد — اضغط «متابعة» لحفظها." : "These changes aren't saved yet — press Continue to save them."}
    </Notice>
  );
}

/* ── Layout ─────────────────────────────────────────────────────────────── */

export function StepHeader({ eyebrow, title, hint }: { eyebrow?: string; title: string; hint?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-1.5">
      {eyebrow && <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>}
      <h2 className="font-display text-xl font-semibold leading-tight sm:text-2xl">{title}</h2>
      {hint && <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p>}
    </header>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      {(title || description) && (
        <div>
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * One clear primary action per step. On phones it sticks to the thumb zone
 * above the home indicator; on larger screens it sits at the end of the form.
 */
export function ActionBar({
  isAr,
  onBack,
  primaryLabel,
  onPrimary,
  loading,
  disabled,
  primaryType = "button",
  note,
}: {
  isAr: boolean;
  onBack?: () => void;
  primaryLabel: string;
  onPrimary?: () => void;
  loading?: boolean;
  disabled?: boolean;
  primaryType?: "button" | "submit";
  note?: React.ReactNode;
}) {
  return (
    <>
      {/* Spacer so the fixed bar never covers the last field on mobile. */}
      <div className="h-24 sm:hidden" aria-hidden />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur pb-safe-6",
          "sm:static sm:z-auto sm:mt-2 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
        )}
      >
        {note && <div className="mb-2 text-center text-xs text-muted-foreground sm:text-start">{note}</div>}
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {onBack && (
            <Button type="button" variant="outline" size="lg" onClick={onBack} className="shrink-0 px-5">
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
              {isAr ? "رجوع" : "Back"}
            </Button>
          )}
          <Button
            type={primaryType}
            size="lg"
            onClick={onPrimary}
            loading={loading}
            disabled={disabled}
            className="flex-1 sm:ms-auto sm:flex-none sm:px-10"
          >
            {primaryLabel}
            {!loading && <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />}
          </Button>
        </div>
      </div>
    </>
  );
}

export function Centered({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto grid min-h-[60vh] w-full max-w-md place-items-center px-4 py-10", className)}>
      <div className="flex w-full flex-col items-center gap-3 text-center">{children}</div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  isAr,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  isAr: boolean;
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button type="button" variant="destructive" loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

/** Scroll to and focus the first invalid control after a failed Continue. */
export function focusFirstError(root: HTMLElement | null) {
  if (!root) return;
  window.requestAnimationFrame(() => {
    const el = root.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    }
  });
}
