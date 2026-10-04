"use client";

import * as React from "react";
import { cn } from "../lib/cn";

/**
 * The one switch (audit Part 05: "7 switch implementations"; M5: 24px targets).
 * The visible track is 24×44 but the button itself is a 44×44 hit area, and
 * when `label` is given the whole row is the control (R092).
 */
export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label — makes the whole row tappable. */
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, label, description, className, disabled, ...props },
  ref,
) {
  const labelId = React.useId();
  const descId = React.useId();
  const control = (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? labelId : undefined}
      aria-describedby={description ? descId : undefined}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group relative inline-grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors duration-150",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-card shadow-e1 transition-[inset-inline-start] duration-150",
            checked ? "start-[1.375rem]" : "start-0.5",
          )}
        />
      </span>
    </button>
  );
  if (!label) return control;
  return (
    <div
      className={cn("flex min-h-11 cursor-pointer items-center justify-between gap-4", disabled && "cursor-not-allowed")}
      onClick={(e) => {
        if (disabled || (e.target as HTMLElement).closest("button")) return;
        onCheckedChange(!checked);
      }}
    >
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-medium">{label}</p>
        {description && <p id={descId} className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {control}
    </div>
  );
});
