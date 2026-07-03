import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-secondary text-secondary-foreground",
        accent: "bg-accent/15 text-accent-foreground",
        success: "bg-success/12 text-success",
        warning: "bg-warning/15 text-[hsl(38_92%_34%)] dark:text-warning",
        info: "bg-info/12 text-info",
        destructive: "bg-destructive/10 text-destructive",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

const dotColors: Record<string, string> = {
  default: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
  accent: "bg-accent",
  secondary: "bg-muted-foreground",
  outline: "bg-muted-foreground",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Render a small leading status dot. */
  dot?: boolean;
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className={cn("size-1.5 rounded-full", dotColors[variant ?? "default"])} />}
      {children}
    </span>
  );
}

export { badgeVariants };
