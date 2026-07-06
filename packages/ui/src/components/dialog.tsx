"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { useFocusTrap } from "../lib/use-focus-trap";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  /** Footer actions (buttons). */
  footer?: React.ReactNode;
  className?: string;
}

/** Accessible modal: role=dialog, aria-modal, Esc + scrim dismiss, focus capture. */
export function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
  // Traps Tab within the panel and restores focus to the trigger on close.
  const panelRef = useFocusTrap<HTMLDivElement>(open);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Scrim (50% black) isolates foreground; click dismisses. */}
      <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-md animate-scale-in rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-e3 outline-none",
          className
        )}
      >
        <h2 id={titleId} className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p id={descId} className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
        {children && <div className="mt-4">{children}</div>}
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
