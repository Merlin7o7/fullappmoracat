"use client";

import * as React from "react";
import { cn } from "../lib/cn";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Side panel on desktop; bottom sheet on mobile. */
  className?: string;
}

export function Drawer({ open, onClose, title, children, className }: DrawerProps) {
  const titleId = React.useId();
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[85dvh] animate-slide-in-up overflow-y-auto rounded-t-2xl border border-border bg-card p-6 shadow-e3",
          "sm:inset-y-0 sm:end-0 sm:inset-x-auto sm:h-full sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none sm:rounded-s-2xl",
          className
        )}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 id={titleId} className="font-display text-lg font-semibold tracking-tight">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
