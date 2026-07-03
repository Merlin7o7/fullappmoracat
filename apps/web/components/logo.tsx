import { cn } from "@moraqat/ui";

/**
 * The Moracat brand lockup (مرقط / Moracat). Green on light surfaces, cream on
 * dark — swapped via the `dark:` variant so it reads on any background.
 * Set the height via `className` (e.g. h-9 in a navbar, h-14 in a footer);
 * width follows the intrinsic aspect ratio.
 */
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      {/* eslint-disable @next/next/no-img-element */}
      <img
        src="/brand/moracat-logo.png"
        alt="Moracat"
        loading={priority ? "eager" : "lazy"}
        className="block h-full w-auto object-contain dark:hidden"
      />
      <img
        src="/brand/moracat-logo-light.png"
        alt="Moracat"
        loading={priority ? "eager" : "lazy"}
        className="hidden h-full w-auto object-contain dark:block"
        aria-hidden="true"
      />
      {/* eslint-enable @next/next/no-img-element */}
    </span>
  );
}
