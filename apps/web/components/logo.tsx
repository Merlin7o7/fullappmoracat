import { cn } from "@moraqat/ui";

export type LogoLockup = "stacked" | "horizontal" | "arabic" | "symbol";

/**
 * The Moracat brand lockup — the designer's vector redraw (delivery
 * 2026-10-03, design/delivery-2026-10-03/01-logo). Four lockups:
 *   stacked     مرقط over Moracat (the default; same proportions as before)
 *   horizontal  Moracat · مرقط side by side, for tight bars
 *   arabic      the wordmark alone
 *   symbol      the ق whose dots read as ears — for ≤ 24 px
 * Emerald on light surfaces, paper on dark (swapped with `dark:`), or forced
 * paper with `onDark`. Below the minimum sizes (stacked 72 px, horizontal
 * 96 px, arabic 48 px wide) use the symbol. Set the height via className.
 */
export function Logo({
  className,
  priority,
  onDark,
  lockup = "stacked",
}: {
  className?: string;
  priority?: boolean;
  onDark?: boolean;
  lockup?: LogoLockup;
}) {
  const src = (colour: "emerald" | "paper") => `/brand/logo/${lockup}-${colour}.svg`;
  const loading = priority ? "eager" : "lazy";
  return (
    <span className={cn("inline-flex items-center", className)}>
      {/* eslint-disable @next/next/no-img-element */}
      {onDark ? (
        // Forced light lockup — for permanently dark surfaces (green rail, footer).
        <img src={src("paper")} alt="Moracat" loading={loading} className="block h-full w-auto object-contain" />
      ) : (
        <>
          <img src={src("emerald")} alt="Moracat" loading={loading} className="block h-full w-auto object-contain dark:hidden" />
          <img src={src("paper")} alt="Moracat" loading={loading} className="hidden h-full w-auto object-contain dark:block" aria-hidden="true" />
        </>
      )}
      {/* eslint-enable @next/next/no-img-element */}
    </span>
  );
}
