"use client";

import * as React from "react";
import { cn } from "@moraqat/ui";
import { Illo3D, type Illo3DName } from "./illo-3d";

/**
 * The two places the 3D objects are allowed to be the hero — packaged, so the
 * brand rules are obeyed by construction rather than by remembering them.
 *
 * WHY THESE EXIST
 * The 3D tier has firm guardrails (DESIGN-AUTHORITY, "Illustration tiers"):
 * one object per screen, 64 px or larger, never recoloured or captioned, the
 * ground tinted instead of the object, motion no livelier than a slow float.
 * Scattering raw `<Illo3D>` across thirty new screens would mean re-deciding
 * all of that thirty times, and "premium through restraint" loses that
 * argument eventually. So the decisions live here:
 *
 *   · `IlloEmpty`  — an empty state as a WELCOME, never a void (R111). The
 *     object is the whole emotional content of the screen, so it gets room,
 *     a tinted ground, and exactly one action.
 *   · `IlloHeader` — a page's opening. A smaller object beside the title, at
 *     the 64 px floor, so a section is recognisable before it is read.
 *
 * `tone` tints the GROUND — the soft disc the object sits on — and never the
 * object. Copper stays where it belongs: the dark-theme mouse, nowhere else.
 */

export type IlloTone = "cream" | "sage" | "butter" | "peach" | "blush" | "none";

/** The warm paper grounds from the brand palette. Never applied to an object. */
const TONE: Record<IlloTone, string> = {
  cream: "bg-cream",
  sage: "bg-primary/10",
  butter: "bg-amber-100/70 dark:bg-amber-500/10",
  peach: "bg-orange-100/70 dark:bg-orange-500/10",
  blush: "bg-rose-100/60 dark:bg-rose-500/10",
  none: "",
};

export interface IlloEmptyProps {
  /** Which brand object carries this moment. One per screen. */
  name: Illo3DName;
  variant?: string;
  tone?: IlloTone;
  title: string;
  body?: string;
  /** One clear action (R005). A second is a `secondary`, never a peer. */
  action?: React.ReactNode;
  secondary?: React.ReactNode;
  /** Gentle float. Off for anything a person is waiting on. */
  float?: boolean;
  className?: string;
  /** Tighter padding for an empty state inside a card rather than a page. */
  compact?: boolean;
}

/**
 * An empty state that reads as a welcome. Used by adoption, lost & found,
 * transfers, the explore home and every "nothing here yet" in the portal — so
 * they all feel like one product rather than six screens that each ran out of
 * content differently.
 */
export function IlloEmpty({
  name,
  variant,
  tone = "cream",
  title,
  body,
  action,
  secondary,
  float = true,
  className,
  compact = false,
}: IlloEmptyProps) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-3xl border border-dashed border-border text-center",
        compact ? "px-5 py-10" : "px-6 py-14 sm:py-16",
        className
      )}
    >
      <div className="relative grid place-items-center">
        {tone !== "none" && (
          <span
            aria-hidden
            className={cn(
              "absolute rounded-full blur-2xl",
              compact ? "size-24" : "size-36",
              TONE[tone],
              "opacity-80"
            )}
          />
        )}
        <Illo3D
          name={name}
          variant={variant}
          px={compact ? 96 : 128}
          className={cn(
            "relative",
            compact ? "size-24" : "size-32",
            // Reduced motion is honoured globally by `motion-safe:` (R075).
            float && "motion-safe:animate-float"
          )}
        />
      </div>
      <p className={cn("mt-5 font-display font-bold tracking-tight", compact ? "text-base" : "text-lg sm:text-xl")}>
        {title}
      </p>
      {body && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>}
      {(action || secondary) && (
        <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row">
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}

export interface IlloHeaderProps {
  name: Illo3DName;
  variant?: string;
  tone?: IlloTone;
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  /** Actions sit under the copy on mobile, beside it from `sm` up. */
  actions?: React.ReactNode;
  /** Centred (a landing section) vs. start-aligned (a portal page). */
  align?: "center" | "start";
  className?: string;
}

/**
 * A section's opening, with its object. The object is 64–96 px — the brand's
 * floor for the 3D tier — and sits on a tinted ground so it belongs to the page
 * instead of hovering over it.
 */
export function IlloHeader({
  name,
  variant,
  tone = "cream",
  eyebrow,
  title,
  body,
  actions,
  align = "center",
  className,
}: IlloHeaderProps) {
  const centred = align === "center";
  return (
    <header
      className={cn(
        "flex gap-4",
        centred ? "flex-col items-center text-center" : "flex-col items-start sm:flex-row sm:items-center",
        className
      )}
    >
      <div className="relative grid shrink-0 place-items-center">
        {tone !== "none" && (
          <span aria-hidden className={cn("absolute size-20 rounded-full blur-xl opacity-80", TONE[tone])} />
        )}
        <Illo3D name={name} variant={variant} px={80} className="relative size-20" priority />
      </div>
      <div className={cn("min-w-0", centred && "flex flex-col items-center")}>
        {eyebrow && (
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {body && (
          <p className={cn("mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base", centred && "max-w-xl")}>
            {body}
          </p>
        )}
        {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * A small object for a feature card or a success moment — still at the 64 px
 * floor, still on a tinted ground, never below the size where plush turns muddy.
 */
export function IlloBadge({
  name,
  variant,
  tone = "cream",
  className,
  float = false,
}: {
  name: Illo3DName;
  variant?: string;
  tone?: IlloTone;
  className?: string;
  float?: boolean;
}) {
  return (
    <span className={cn("relative grid size-16 shrink-0 place-items-center", className)}>
      {tone !== "none" && (
        <span aria-hidden className={cn("absolute size-14 rounded-full blur-lg opacity-80", TONE[tone])} />
      )}
      <Illo3D
        name={name}
        variant={variant}
        px={64}
        className={cn("relative size-16", float && "motion-safe:animate-float")}
      />
    </span>
  );
}
