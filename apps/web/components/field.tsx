"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn, Input } from "@moraqat/ui";

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  autoFocus?: boolean;
}

/** Labelled input used across auth + portal forms (a11y-first). */
export function Field({
  label, value, onChange, type = "text", placeholder, required, hint, error, className, inputMode, autoComplete, autoFocus,
}: FieldProps) {
  const id = React.useId();
  const [show, setShow] = React.useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword && show ? "text" : type;
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="ms-0.5 text-destructive" aria-hidden>*</span>}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={resolvedType}
          value={value}
          required={required}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          invalid={!!error}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={cn(isPassword && "pe-11", (type === "number") && "tabular")}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            // ≥44px touch target (R092): the reveal fills the input's full height
            // and a 44px-wide column flush to the inline-end edge. The icon keeps
            // its size-4 glyph, centred where it sat before; the input's pe-11
            // (44px) padding still clears it in both LTR and RTL (logical end-0).
            className="absolute inset-y-0 end-0 flex min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  required?: boolean;
  hint?: string;
  error?: string;
}

export function SelectField({ label, value, onChange, options, className, required, hint, error }: SelectFieldProps) {
  const id = React.useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="ms-0.5 text-destructive" aria-hidden>*</span>}
      </label>
      <select
        id={id}
        value={value}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 rounded-xl border bg-background px-3 text-sm shadow-e1 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          error ? "border-destructive" : "border-input"
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
