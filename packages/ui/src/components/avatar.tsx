import * as React from "react";
import { cn } from "../lib/cn";

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name?: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
}

const sizes = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-12 text-base" };

/** Initials avatar with optional image; deterministic accent from the name. */
export function Avatar({ name, src, size = "md", className, ...props }: AvatarProps) {
  const initials = (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary/12 font-semibold text-primary ring-hairline",
        sizes[size],
        className
      )}
      {...props}
    >
      {/* Initials sit behind; a loaded image covers them. If the image fails to
          load it hides itself, revealing the initials — never a broken "?". */}
      <span aria-hidden>{initials || "•"}</span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? ""}
          className="absolute inset-0 size-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
    </span>
  );
}
