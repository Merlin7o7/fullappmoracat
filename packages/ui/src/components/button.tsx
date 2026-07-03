import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  // Base: crisp focus ring, tap-optimised, spring-y press, consistent icon sizing.
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium [touch-action:manipulation] transition-[transform,box-shadow,background-color,filter] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-b from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow-e1 ring-hairline hover:shadow-glow hover:brightness-[1.06]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-e1 hover:bg-secondary/80",
        accent:
          "bg-gradient-to-b from-accent to-[hsl(32_92%_46%)] text-accent-foreground shadow-e1 ring-hairline hover:brightness-[1.05]",
        outline:
          "border border-border bg-background/40 hover:border-primary/40 hover:bg-muted",
        ghost: "hover:bg-muted",
        glass: "glass text-foreground hover:bg-white/80 dark:hover:bg-white/[0.09]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-e1 hover:brightness-[1.08]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-6",
        lg: "h-13 px-8 text-base",
        xl: "h-14 px-9 text-base",
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
