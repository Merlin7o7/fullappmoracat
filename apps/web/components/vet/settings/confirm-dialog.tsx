"use client";

/**
 * Confirm a consequential action without trapping anyone (R116): the dialog
 * names exactly what will happen, the safe choice is always one tap, and an
 * optional reason lands in the audit trail rather than in a free-text void.
 */

import * as React from "react";
import { Button, Dialog } from "@moraqat/ui";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  busy,
  error,
  reasonLabel,
  reasonHint,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  busy?: boolean;
  error?: { title: string; message: string } | null;
  /** Render an optional reason field (recorded in the audit trail). */
  reasonLabel?: string;
  reasonHint?: string;
}) {
  const [reason, setReason] = React.useState("");
  const id = React.useId();
  React.useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(reason.trim());
        }}
      >
        {reasonLabel && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-sm font-medium">
              {reasonLabel}
            </label>
            <textarea
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              rows={2}
              className="rounded-xl border border-input bg-background px-4 py-2.5 text-sm shadow-e1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {reasonHint && <p className="text-xs text-muted-foreground">{reasonHint}</p>}
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5">
            <p className="text-sm font-medium text-destructive">{error.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{error.message}</p>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button type="submit" variant={destructive ? "destructive" : "brand"} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Inline, calm error block — the same shape everywhere on these screens. */
export function InlineError({ error }: { error: { title: string; message: string } | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5">
      <p className="text-sm font-medium text-destructive">{error.title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{error.message}</p>
    </div>
  );
}
