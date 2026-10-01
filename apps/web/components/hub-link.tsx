import type * as React from "react";
import Link from "next/link";

/** A door from a tab's hub page to one of its places — icon, name, one line of why. */
export function HubLink({
  href,
  icon: Icon,
  title,
  body,
  tone,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  body: string;
  tone?: "critical";
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/25"
    >
      <span
        className={
          tone === "critical"
            ? "grid size-10 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive"
            : "grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"
        }
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{body}</span>
      </span>
    </Link>
  );
}
