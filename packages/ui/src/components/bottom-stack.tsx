"use client";

import * as React from "react";
import { cn } from "../lib/cn";

/**
 * One bottom stack (audit MRC-UX-AUDIT-2026-10-04, M2 / Part 05 "Bottom stack").
 *
 * Every fixed-bottom element — the portal tab bar, a page's sticky CTA, the
 * checkout pay bar, the cookie notice — registers here instead of claiming
 * `fixed bottom-0 z-40` for itself. The provider measures each registered bar
 * and stacks them by `layer` (lowest layer sits on the screen edge), so nothing
 * ever covers anything else, and publishes the total height as `--bottom-stack`
 * (px) on <html>. Toasts and page padding read that variable.
 *
 * Layers (by convention — higher sits above lower):
 *   0  navigation  (portal tab bar)
 *   10 page action (register CTA, finder CTA, checkout pay bar)
 *   20 notice      (cookie / measurement notice)
 *
 * Safe area: only the bar that touches the screen edge pads for the home
 * indicator (via `--bb-safe` + the `.pb-bar` / `.pb-bar-0` utilities); bars
 * stacked above it don't double the inset.
 */

export const BOTTOM_LAYER = { nav: 0, action: 10, notice: 20 } as const;

interface Entry {
  layer: number;
  height: number;
  /** Registration order — breaks ties within a layer deterministically. */
  seq: number;
}

interface BottomStackCtx {
  register: (id: string, layer: number) => void;
  unregister: (id: string) => void;
  setHeight: (id: string, height: number) => void;
  offsets: Record<string, number>;
}

const Ctx = React.createContext<BottomStackCtx | null>(null);

export function BottomStackProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = React.useState<Record<string, Entry>>({});
  const seq = React.useRef(0);

  const register = React.useCallback((id: string, layer: number) => {
    setEntries((prev) => ({ ...prev, [id]: { layer, height: prev[id]?.height ?? 0, seq: prev[id]?.seq ?? ++seq.current } }));
  }, []);
  const unregister = React.useCallback((id: string) => {
    setEntries((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);
  const setHeight = React.useCallback((id: string, height: number) => {
    setEntries((prev) => {
      const e = prev[id];
      if (!e || Math.abs(e.height - height) < 0.5) return prev;
      return { ...prev, [id]: { ...e, height } };
    });
  }, []);

  const { offsets, total } = React.useMemo(() => {
    const sorted = Object.entries(entries).sort(([, a], [, b]) => a.layer - b.layer || a.seq - b.seq);
    const out: Record<string, number> = {};
    let acc = 0;
    for (const [id, e] of sorted) {
      out[id] = acc;
      acc += e.height;
    }
    return { offsets: out, total: acc };
  }, [entries]);

  React.useEffect(() => {
    document.documentElement.style.setProperty("--bottom-stack", `${Math.round(total)}px`);
  }, [total]);
  React.useEffect(() => () => { document.documentElement.style.removeProperty("--bottom-stack"); }, []);

  const value = React.useMemo(() => ({ register, unregister, setHeight, offsets }), [register, unregister, setHeight, offsets]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export interface BottomBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stacking layer — see BOTTOM_LAYER. Higher sits above lower. */
  layer?: number;
  /** Pad for the iOS home indicator when this bar touches the screen edge. Default true. */
  safeArea?: boolean;
  /** Render as a different element (e.g. "nav"). */
  as?: "div" | "nav" | "aside" | "section";
}

/**
 * A fixed bar on the bottom edge that takes its place in the stack. Pass
 * responsive visibility (e.g. `sm:hidden`) via className — a hidden bar
 * measures 0 and stops taking room. Works without a provider (falls back to
 * a plain bottom-0 bar) so a stray render can never crash a page.
 */
export const BottomBar = React.forwardRef<HTMLDivElement, BottomBarProps>(function BottomBar(
  { layer = BOTTOM_LAYER.action, safeArea = true, as = "div", className, style, children, ...props },
  forwardedRef,
) {
  const ctx = React.useContext(Ctx);
  const id = React.useId();
  const ref = React.useRef<HTMLDivElement | null>(null);
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      ref.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  const register = ctx?.register;
  const unregister = ctx?.unregister;
  const setHeight = ctx?.setHeight;

  React.useEffect(() => {
    if (!register || !unregister) return;
    register(id, layer);
    return () => unregister(id);
  }, [register, unregister, id, layer]);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || !setHeight) return;
    // display:none (a `sm:hidden` bar on desktop) measures 0 — it gives its room back.
    const measure = () => setHeight(id, node.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [setHeight, id]);

  const offset = ctx?.offsets[id] ?? 0;
  const touchesEdge = offset < 1;
  const Comp = as as "div";

  return (
    <Comp
      ref={setRefs}
      data-bottom-bar=""
      className={cn("fixed inset-x-0 z-40 transition-[bottom] duration-200 ease-out", className)}
      style={{
        bottom: offset,
        // The home-indicator inset, published only on the bar that touches the
        // edge. Consumers pad with `.pb-bar` (max(0.75rem, --bb-safe)) or
        // `.pb-bar-0` (exactly the inset), so bars stacked above don't double it.
        ["--bb-safe" as string]: safeArea && touchesEdge ? "env(safe-area-inset-bottom)" : "0px",
        ...style,
      }}
      {...props}
    >
      {children}
    </Comp>
  );
});
