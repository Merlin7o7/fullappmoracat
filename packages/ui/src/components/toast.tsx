"use client";

import * as React from "react";
import { cn } from "../lib/cn";

type ToastVariant = "default" | "success" | "error" | "info";
interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}
interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

const ToastContext = React.createContext<{ toast: (o: ToastOptions) => void } | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const variantStyles: Record<ToastVariant, string> = {
  default: "border-border",
  success: "border-success/30",
  error: "border-destructive/30",
  info: "border-info/30",
};
const accentBar: Record<ToastVariant, string> = {
  default: "bg-primary",
  success: "bg-success",
  error: "bg-destructive",
  info: "bg-info",
};

interface Timer {
  timeout: number;
  remaining: number;
  start: number;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const counter = React.useRef(0);
  const timers = React.useRef<Map<number, Timer>>(new Map());

  const dismiss = React.useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t.timeout);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  // Pause on hover/focus so a reader is never raced by the auto-dismiss timer
  // (WCAG 2.2.1 Timing Adjustable). We track remaining time and restart on leave.
  const pause = React.useCallback((id: number) => {
    const t = timers.current.get(id);
    if (!t) return;
    window.clearTimeout(t.timeout);
    t.remaining = Math.max(0, t.remaining - (Date.now() - t.start));
  }, []);

  const resume = React.useCallback((id: number) => {
    const t = timers.current.get(id);
    if (!t) return;
    t.start = Date.now();
    t.timeout = window.setTimeout(() => dismiss(id), t.remaining);
  }, [dismiss]);

  const toast = React.useCallback(
    ({ title, description, variant = "default", duration }: ToastOptions) => {
      const id = ++counter.current;
      // Errors linger longer by default — they carry recovery instructions (R112).
      const ms = duration ?? (variant === "error" ? 7000 : 4000);
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      timers.current.set(id, { timeout: window.setTimeout(() => dismiss(id), ms), remaining: ms, start: Date.now() });
    },
    [dismiss],
  );

  React.useEffect(() => {
    const map = timers.current;
    return () => { map.forEach((t) => window.clearTimeout(t.timeout)); };
  }, []);

  const assertive = toasts.filter((t) => t.variant === "error");
  const polite = toasts.filter((t) => t.variant !== "error");

  const renderCard = (t: ToastItem) => (
    <div
      key={t.id}
      role={t.variant === "error" ? "alert" : "status"}
      onMouseEnter={() => pause(t.id)}
      onMouseLeave={() => resume(t.id)}
      onFocusCapture={() => pause(t.id)}
      onBlurCapture={() => resume(t.id)}
      className={cn(
        "pointer-events-auto relative flex w-full max-w-sm animate-slide-in-up items-start gap-3 overflow-hidden rounded-xl border bg-popover p-4 pe-10 text-popover-foreground shadow-e3",
        variantStyles[t.variant],
      )}
    >
      <span className={cn("mt-0.5 h-full w-1 shrink-0 self-stretch rounded-full", accentBar[t.variant])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t.title}</p>
        {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
      </div>
      <button
        onClick={() => dismiss(t.id)}
        aria-label="Dismiss"
        className="absolute end-3 top-3 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Two persistent live regions: errors announce assertively (they can't be
          missed before auto-dismiss), everything else politely. Both are always
          in the DOM so SRs register the region before content arrives. */}
      <div
        aria-live="assertive"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {assertive.map(renderCard)}
      </div>
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {polite.map(renderCard)}
      </div>
    </ToastContext.Provider>
  );
}
