"use client";

import { Button, Dialog } from "@moraqat/ui";

/**
 * The one delete confirmation (audit 2026-10-04, Trust: "four different
 * delete confirmations — inline panel, window.confirm, double-tap within 4 s
 * and a Dialog"). Built on the ui Dialog: the action is named on the button
 * («احذف الصورة»), the safe choice is equal and first, Esc / scrim cancel,
 * and nothing happens until the named action is pressed (R116).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  isAr,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  /** Names the action, e.g. «احذف الصورة» — never "OK". */
  confirmLabel: string;
  isAr: boolean;
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
