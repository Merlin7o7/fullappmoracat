import * as React from "react";
import { cn } from "../lib/cn";
import { Skeleton } from "./skeleton";

/**
 * The three non-happy states every screen has — one pattern each, so an empty
 * list, a failed load and a wait look the same wherever they happen (R111).
 *
 * `art` is a slot: the web passes one of the brand's 3D objects (Illo3D) for
 * owner surfaces and nothing for clinical ones — the vet portal stays plain.
 */

export interface EmptyStateProps {
  title: React.ReactNode;
  body?: React.ReactNode;
  art?: React.ReactNode;
  /** One clear next step (R005) — usually a primary or secondary Button. */
  action?: React.ReactNode;
  /** `quiet` for inside a card; `page` for a whole-screen welcome. */
  size?: "quiet" | "page";
  className?: string;
}

export function EmptyState({ title, body, art, action, size = "quiet", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        size === "page" ? "gap-4 px-4 py-14 sm:py-20" : "gap-3 px-4 py-8",
        className
      )}
    >
      {art ? <div aria-hidden>{art}</div> : null}
      <div className="max-w-sm space-y-1.5">
        <p className={cn("font-display text-foreground", size === "page" ? "text-2xl" : "text-lg")}>{title}</p>
        {body ? <p className="text-sm text-muted-foreground">{body}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  title: React.ReactNode;
  body?: React.ReactNode;
  /** Retry handler; renders the retry control when given. */
  onRetry?: () => void;
  retryLabel?: React.ReactNode;
  retrying?: boolean;
  className?: string;
}

/** A failure that says what happened and what to do — never a dead end (R078). */
export function ErrorState({ title, body, onRetry, retryLabel = "Try again", retrying, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 px-4 py-8 text-center", className)}>
      <span aria-hidden className="grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 8v5m0 3.5v.01" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </span>
      <div className="max-w-sm space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        {body ? <p className="text-sm text-muted-foreground">{body}</p> : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex h-11 items-center rounded-md border border-border bg-card px-5 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

/** Placeholder rows shaped like the content that is coming (no spinners for lists). */
export function LoadingState({ rows = 3, className, label = "Loading" }: { rows?: number; className?: string; label?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("space-y-3", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-md" />
      ))}
    </div>
  );
}

// ── Status tags ──────────────────────────────────────────────────────────

export type StatusTone = "neutral" | "positive" | "attention" | "critical" | "info" | "brand";

const TONE: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  positive: "bg-success/12 text-success",
  attention: "bg-warning/15 text-[hsl(38_92%_26%)] dark:text-warning-ink",
  critical: "bg-destructive/10 text-destructive",
  info: "bg-info/12 text-[hsl(200_82%_30%)] dark:text-info",
  brand: "bg-primary/10 text-primary",
};

/**
 * A state, said in words with a shape beside it — colour is never the only
 * signal (R093). Used for care (due / overdue / done), adoption listings
 * (available / reserved / adopted), trust (verified / unverified / reported)
 * and lost & found.
 */
export function StatusTag({
  tone = "neutral",
  children,
  className,
  icon,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", TONE[tone], className)}>
      {icon ?? <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
