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

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const counter = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    ({ title, description, variant = "default", duration = 4000 }: ToastOptions) => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* aria-live announces without stealing focus. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm animate-slide-in-up items-start gap-3 overflow-hidden rounded-xl border bg-popover p-4 pe-10 text-popover-foreground shadow-e3",
              variantStyles[t.variant]
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
        ))}
      </div>
    </ToastContext.Provider>
  );
}
