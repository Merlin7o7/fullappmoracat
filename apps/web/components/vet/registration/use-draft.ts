"use client";

/**
 * Keep what a clinic manager typed, even through a reload, a dead battery or a
 * patient walking in mid-form (R117 — never lose entered data).
 *
 * The draft lives in localStorage keyed by clinic + step. It is written only
 * when the person actually edits (so an untouched step always shows the
 * server's truth), and cleared the moment the step saves successfully.
 */

import * as React from "react";

const PREFIX = "mrc.vet-register.v1";

export function draftKey(orgId: string, part: string): string {
  return `${PREFIX}.${orgId}.${part}`;
}

interface Stored<T> {
  savedAt: number;
  data: T;
}

function read<T>(key: string): Stored<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored<T>;
    return parsed && typeof parsed === "object" && "data" in parsed ? parsed : null;
  } catch {
    return null;
  }
}

function write<T>(key: string, data: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data } satisfies Stored<T>));
  } catch {
    /* storage full or blocked — the form still works, it just won't survive a reload */
  }
}

function remove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export interface Draft<T> {
  value: T;
  /** Update the form and persist the draft. */
  set: (next: T | ((prev: T) => T)) => void;
  /** Replace the form with fresh server data and forget the draft. */
  reset: (next: T) => void;
  /** True when the form was restored from an unsaved draft. */
  restored: boolean;
  /** When the restored draft was last written. */
  restoredAt: number | null;
}

export function useDraft<T>(key: string, fromServer: () => T): Draft<T> {
  const [state, setState] = React.useState<{ value: T; restoredAt: number | null }>(() => {
    const stored = read<T>(key);
    return stored ? { value: stored.data, restoredAt: stored.savedAt } : { value: fromServer(), restoredAt: null };
  });

  const set = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => {
        const value = typeof next === "function" ? (next as (p: T) => T)(prev.value) : next;
        write(key, value);
        return { value, restoredAt: prev.restoredAt };
      });
    },
    [key]
  );

  const reset = React.useCallback(
    (next: T) => {
      remove(key);
      setState({ value: next, restoredAt: null });
    },
    [key]
  );

  return { value: state.value, set, reset, restored: state.restoredAt !== null, restoredAt: state.restoredAt };
}

/** Forget every draft for a clinic — after a successful submission. */
export function clearAllDrafts(orgId: string) {
  if (typeof window === "undefined") return;
  try {
    const prefix = `${PREFIX}.${orgId}.`;
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    keys.forEach(remove);
  } catch {
    /* ignore */
  }
}
