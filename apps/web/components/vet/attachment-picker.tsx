"use client";

import * as React from "react";
import { Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@moraqat/ui";

/** Mirrors the API ceiling (VET_ATTACHMENT_MAX_BYTES). */
export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,application/pdf";

/**
 * Files to attach to a clinical entry (T12): X-rays, lab PDFs, photos. Picked
 * before saving, uploaded right after the entry exists — an upload can fail
 * without ever costing the vet their entry. PDF / JPEG / PNG, 20 MB each.
 */
export function AttachmentPicker({
  files,
  onChange,
  isAr,
  className,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  isAr: boolean;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  function add(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    let rejected = 0;
    for (const f of Array.from(list)) {
      const okType = ["image/jpeg", "image/png", "application/pdf"].includes(f.type);
      if (!okType || f.size > ATTACHMENT_MAX_BYTES) {
        rejected += 1;
        continue;
      }
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    setError(
      rejected
        ? isAr
          ? `تجاهلنا ${rejected} ملف — المقبول: PDF أو JPEG أو PNG حتى ٢٠ ميغابايت.`
          : `${rejected} file(s) skipped — PDF, JPEG or PNG up to 20 MB.`
        : null
    );
    onChange(next.slice(0, 10));
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input ref={inputRef} type="file" accept={ACCEPT} multiple className="sr-only" id="entry-attachments" onChange={(e) => add(e.target.files)} />
      <label
        htmlFor="entry-attachments"
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-within:ring-2 focus-within:ring-ring"
      >
        <Paperclip className="size-4" aria-hidden />
        {isAr ? "أرفق أشعة أو تحاليل أو صورة" : "Attach an X-ray, lab result or photo"}
        <span className="text-xs">{isAr ? "(PDF · JPEG · PNG)" : "(PDF · JPEG · PNG)"}</span>
      </label>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((f) => (
            <li key={`${f.name}-${f.size}`} className="flex items-center gap-2 rounded-xl border border-border bg-background p-1.5 pe-1 text-xs">
              <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
                {f.type === "application/pdf" ? <FileText className="size-4" aria-hidden /> : <ImageIcon className="size-4" aria-hidden />}
              </span>
              <span className="max-w-[10rem] truncate" dir="ltr">
                {f.name}
              </span>
              <button
                type="button"
                onClick={() => onChange(files.filter((x) => x !== f))}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={isAr ? "أزل الملف" : "Remove file"}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
