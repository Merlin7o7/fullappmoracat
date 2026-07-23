"use client";

/**
 * A slim, honest marker that this is a sandbox — and the controls a demo needs:
 * reset the clinic, and see the accounts you can sign in as. Renders only in
 * demo builds, only on the vet portal, and never covers the portal's own
 * bottom tab bar (it tucks into the top on mobile).
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { FlaskConical, RotateCcw, X } from "lucide-react";
import { DEMO_ENABLED, resetVetDemo } from "@/lib/vet-demo/install";

export function VetDemoRibbon() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);

  if (!DEMO_ENABLED || hidden) return null;
  if (!pathname || !pathname.startsWith("/vet")) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center pt-safe">
        <div className="pointer-events-auto mt-2 flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-50/95 px-3 py-1 text-[0.6875rem] font-medium text-amber-900 shadow-sm backdrop-blur dark:border-amber-500/30 dark:bg-amber-950/85 dark:text-amber-200">
          <FlaskConical className="size-3.5" aria-hidden />
          <span>Live demo · sample data</span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full px-2 py-0.5 underline underline-offset-2 hover:bg-amber-100 dark:hover:bg-amber-900"
          >
            Accounts
          </button>
          <button
            type="button"
            onClick={() => resetVetDemo()}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-amber-100 dark:hover:bg-amber-900"
          >
            <RotateCcw className="size-3" aria-hidden />
            Reset
          </button>
          <button
            type="button"
            onClick={() => setHidden(true)}
            aria-label="Hide demo bar"
            className="rounded-full p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900"
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Demo sign-in accounts"
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Demo accounts</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 hover:bg-muted">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <p className="text-muted-foreground">
                You are signed in as the <strong className="text-foreground">senior veterinarian</strong> — full clinical
                access. Sign out and back in as any account below to see how the portal reshapes itself for each role.
                Password <code className="rounded bg-muted px-1">DemoVet!2026</code> · counter PIN{" "}
                <code className="rounded bg-muted px-1">2468</code>.
              </p>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {[
                  ["demo.owner@moracat.co", "Clinic owner — everything"],
                  ["demo.vet@moracat.co", "Senior vet — full clinical (default)"],
                  ["demo.vet2@moracat.co", "Veterinarian"],
                  ["demo.tech@moracat.co", "Technician — no prescribing"],
                  ["demo.reception@moracat.co", "Reception — no clinical record"],
                ].map(([email, role]) => (
                  <li key={email} className="flex flex-col gap-0.5 px-3 py-2">
                    <code className="text-xs text-foreground">{email}</code>
                    <span className="text-xs text-muted-foreground">{role}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Try: search <code className="rounded bg-muted px-1">مشمش</code> or{" "}
                <code className="rounded bg-muted px-1">MRC-7H2K-94QF</code> for the full patient, and{" "}
                <code className="rounded bg-muted px-1">بسبس</code> to see the consent boundary at tier 0.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
