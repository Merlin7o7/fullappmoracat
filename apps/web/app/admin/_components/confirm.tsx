"use client";

import * as React from "react";
import { Dialog, Button } from "@moraqat/ui";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  title: string;
  description?: string;
  /** Label for the confirm button. */
  confirmLabel: string;
  cancelLabel?: string;
  /** Style the confirm button as a destructive action. */
  destructive?: boolean;
  /** Show an optional free-text reason field, passed back to onConfirm. */
  withReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  /** Confirm button spinner + disabled state while the mutation runs. */
  pending?: boolean;
  isAr?: boolean;
}

/**
 * Confirmation dialog for destructive/irreversible staff actions.
 * Built on the design-system Dialog (scrim dismiss, Esc, focus capture).
 * When `withReason` is set it collects an optional reason and hands it to
 * onConfirm so the caller can forward it to the API.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  withReason = false,
  reasonLabel,
  reasonPlaceholder,
  pending = false,
  isAr = false,
}: ConfirmDialogProps) {
  const [reason, setReason] = React.useState("");

  // Reset the reason whenever the dialog re-opens.
  React.useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const handleConfirm = () => {
    onConfirm(withReason ? reason.trim() || undefined : undefined);
  };

  return (
    <Dialog
      open={open}
      onClose={pending ? () => {} : onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            {cancelLabel ?? (isAr ? "إلغاء" : "Cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            size="sm"
            onClick={handleConfirm}
            loading={pending}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {withReason && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            {reasonLabel ?? (isAr ? "السبب (اختياري)" : "Reason (optional)")}
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            rows={3}
            disabled={pending}
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      )}
    </Dialog>
  );
}
