"use client";

import * as React from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap keyboard focus inside a modal container while it's open, and restore focus
 * to the previously-focused element on close (WAI-ARIA dialog behaviour). Tab and
 * Shift+Tab cycle within the container; focus can never escape to the page behind
 * the scrim. Honors the signature Cat ID ceremony too. (R097)
 *
 * Returns a ref to attach to the modal container.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(open: boolean) {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    if (!open) return;
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    // Move focus into the dialog (first focusable, else the container itself).
    const first = focusables()[0];
    (first ?? node)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !node) return;
      const items = focusables();
      if (items.length === 0) {
        // Nothing focusable inside — keep focus on the container.
        e.preventDefault();
        node.focus();
        return;
      }
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === firstEl || active === node) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Restore focus to whatever opened the dialog.
      previouslyFocused?.focus?.();
    };
  }, [open]);

  return ref;
}
