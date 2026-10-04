import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * Five button types — and only five (AD 2.1 «السجل», MRC-BRAND-001).
 *
 *   primary     the one action a screen exists for. Solid emerald, no gradient.
 *   secondary   a real alternative. Paper with a hairline border.
 *   tertiary    low-emphasis: "cancel", "edit", "see all". Text in emerald.
 *   destructive irreversible or alarming (remove, report lost). Solid red.
 *   contextual  a warm, celebratory or sharing action that belongs to its
 *               moment (share the poster, add to Wallet). Solid warm accent;
 *               at most one per screen, never beside a primary.
 *
 * One radius family for controls (10px). Pills are reserved for chips,
 * avatars and the seal. Every size clears the 44px target except `sm`, which
 * is 44px on phones and 40px from `sm` up (dense desktop rows) (R092).
 */
const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium [touch-action:manipulation] transition-[transform,box-shadow,background-color,border-color,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-e1 hover:bg-[hsl(var(--primary-hover))]",
        secondary: "border border-border bg-card text-foreground hover:border-foreground/25 hover:bg-muted",
        tertiary: "text-primary hover:bg-primary/[0.07]",
        destructive: "bg-destructive text-destructive-foreground shadow-e1 hover:brightness-[1.08]",
        contextual: "bg-accent text-accent-foreground shadow-e1 hover:bg-[hsl(var(--accent-hover))]",
      },
      size: {
        // 44px on phones (owner flows are thumb flows, R092); 40px from `sm` up
        // where dense desktop rows need it (audit M5: 214 owner-facing uses).
        sm: "h-11 px-4 sm:h-10",
        md: "h-11 px-5",
        lg: "h-13 px-7 text-base",
        xl: "h-14 px-8 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading && (
        <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
        </svg>
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export { buttonVariants };
