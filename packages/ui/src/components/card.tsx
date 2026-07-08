import * as React from "react";
import { cn } from "../lib/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  /** Adds a hover lift + pointer affordance for clickable cards. */
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, glass, interactive, onClick, onKeyDown, role, tabIndex, ...props }, ref) => {
    // A clickable card must be operable by keyboard (WCAG 2.1.1): give it a
    // button role, make it focusable, and fire onClick on Enter/Space.
    const clickable = interactive && !!onClick;
    return (
      <div
        ref={ref}
        onClick={onClick}
        role={clickable ? role ?? "button" : role}
        tabIndex={clickable ? tabIndex ?? 0 : tabIndex}
        onKeyDown={
          clickable
            ? (e) => {
                onKeyDown?.(e);
                if ((e.key === "Enter" || e.key === " ") && e.currentTarget === e.target) {
                  e.preventDefault();
                  onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
                }
              }
            : onKeyDown
        }
        className={cn(
          "rounded-2xl border text-card-foreground transition-all duration-300 ease-out",
          glass ? "glass" : "border-border bg-card shadow-e1 ring-hairline",
          interactive &&
            "cursor-pointer hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-display text-lg font-semibold tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
));
CardFooter.displayName = "CardFooter";
