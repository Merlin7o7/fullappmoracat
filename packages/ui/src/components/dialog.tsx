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
  /** Footer actions (buttons). Sticky at the bottom while the body scrolls. */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Accessible modal: role=dialog, aria-modal, Esc + scrim dismiss, focus capture.
 *
 * Audit M3 (R063): the panel never outgrows the screen — it caps at
 * 100dvh − 2rem and scrolls, with the footer pinned so the confirming action
 * stays reachable with the keyboard open. Below `sm` it is a bottom sheet
 * (full width, 18px top corners, slides up; reduced motion stills it).
 */
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
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
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
          "relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden border border-border bg-card text-card-foreground shadow-e3 outline-none",
          // Phone: a bottom sheet. sm+: a centred card.
          "animate-slide-in-up rounded-t-2xl border-b-0 sm:max-w-md sm:animate-scale-in sm:rounded-2xl sm:border-b",
          className
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
          <h2 id={titleId} className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p id={descId} className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
          {children && <div className="mt-4">{children}</div>}
        </div>
        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-card px-6 pb-safe-6 pt-4 sm:flex-row sm:justify-end sm:pb-6">
            {footer}
          </div>
        )}
        {!footer && <span aria-hidden className="block h-[env(safe-area-inset-bottom)] shrink-0 sm:hidden" />}
      </div>
    </div>
  );
}
