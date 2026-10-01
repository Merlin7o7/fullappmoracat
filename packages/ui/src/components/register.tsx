import * as React from "react";
import { cn } from "../lib/cn";

/**
 * «السجل» — the register. Moracat's document language (AD 2.1): every artifact
 * the cat owns — the ID card, the health summary, the certificate, the Wallet
 * pass, the lost poster, an email — is built from the same three pieces, so
 * together they read as one personal archive rather than a set of screens.
 *
 *   IdBand     the strip that names a document: what it is, its serial, its seal.
 *   LedgerRow  a hairline row "label … value" — records are ruled, not boxed.
 *   Seal       the small copper stamp: issued / verified by Moracat.
 *
 * Framing rule: this is the cat's own archive, kept by a private company. It
 * never claims to be official, governmental or national.
 */

export function IdBand({
  kind,
  serial,
  seal,
  tone = "paper",
  className,
}: {
  /** What this document is, e.g. «ملخص صحي» / "Health summary". */
  kind: React.ReactNode;
  /** The Cat ID or document number — always set LTR, mono. */
  serial?: React.ReactNode;
  seal?: React.ReactNode;
  tone?: "paper" | "emerald";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-between gap-3 border-y px-4 py-2.5",
        tone === "emerald"
          ? "border-white/15 bg-[hsl(var(--primary))] text-primary-foreground"
          : "border-border bg-card text-foreground",
        className
      )}
    >
      {/* Perforation: the band reads as a tear-off strip of a real document. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-px h-px [background-image:linear-gradient(to_right,currentColor_50%,transparent_0)] [background-size:6px_1px] opacity-30"
      />
      <span className="text-sm font-medium">{kind}</span>
      <span className="flex items-center gap-2">
        {serial ? (
          <span dir="ltr" className="font-mono text-xs tracking-wider opacity-80">
            {serial}
          </span>
        ) : null}
        {seal}
      </span>
    </div>
  );
}

export function LedgerRow({
  label,
  value,
  hint,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 border-b border-border/70 py-3 last:border-b-0", className)}>
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end">
        <span className="text-sm font-medium text-foreground">{value}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </dd>
    </div>
  );
}

/** A ruled list of LedgerRows — use as the wrapper so rows get <dl> semantics. */
export function Ledger({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("divide-y-0", className)}>{children}</dl>;
}

/**
 * The copper seal. Small, round, never decorative filler: it appears where
 * Moracat vouches for something (issued, verified, signed link).
 */
export function Seal({ label, className }: { label: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-grid size-7 place-items-center rounded-full border border-[hsl(var(--seal))]/50 text-[hsl(var(--seal))]",
        className
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <circle cx="12" cy="12" r="8.5" strokeDasharray="1.5 2" />
        <path d="M8.5 12.2l2.3 2.3 4.7-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
