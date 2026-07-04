/**
 * Moracat flat illustration library — the brand's sticker sheet, in code.
 *
 * Drawn to match the brand artwork: soft flat shapes, no outlines, generous
 * radii, tiny facial details. Every piece is an inline SVG so it inherits
 * theme tokens, scales crisply, and costs zero network requests.
 *
 * Usage discipline (Design Authority R080 — restraint): these are seasoning,
 * not soup. A hero gets two or three stickers; an empty state gets one.
 * All are aria-hidden decorative by default — pass `label` to make one
 * meaningful.
 */
import * as React from "react";
import { cn } from "@moraqat/ui";

/* ── Palette ──────────────────────────────────────────────────────────── */

export type Tone =
  | "green"
  | "orange"
  | "pink"
  | "sage"
  | "butter"
  | "peach"
  | "cream"
  | "leaf";

const TONE: Record<Tone, string> = {
  green: "hsl(var(--primary))",
  orange: "hsl(var(--accent))",
  pink: "hsl(var(--blush))",
  sage: "hsl(var(--sage))",
  butter: "hsl(var(--butter))",
  peach: "hsl(var(--peach))",
  cream: "hsl(var(--cream))",
  leaf: "hsl(var(--leaf))",
};

interface IlloProps extends React.SVGAttributes<SVGSVGElement> {
  tone?: Tone;
  /** Accessible label — omit for purely decorative use (default). */
  label?: string;
}

function svgA11y(label?: string) {
  return label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const };
}

/* ── Paw print ────────────────────────────────────────────────────────── */

export function IlloPaw({ tone = "butter", label, className, ...props }: IlloProps) {
  const fill = TONE[tone];
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} {...svgA11y(label)} {...props}>
      <ellipse cx="20" cy="18" rx="7.5" ry="9.5" transform="rotate(-14 20 18)" fill={fill} />
      <ellipse cx="44" cy="18" rx="7.5" ry="9.5" transform="rotate(14 44 18)" fill={fill} />
      <ellipse cx="8.5" cy="32" rx="6" ry="8" transform="rotate(-26 8.5 32)" fill={fill} />
      <ellipse cx="55.5" cy="32" rx="6" ry="8" transform="rotate(26 55.5 32)" fill={fill} />
      <path
        d="M32 30c8.5 0 15.5 6.2 15.5 14.2 0 6.6-4.7 10.8-9.4 10.8-2.5 0-4.3-.9-6.1-.9s-3.6.9-6.1.9c-4.7 0-9.4-4.2-9.4-10.8C16.5 36.2 23.5 30 32 30Z"
        fill={fill}
      />
    </svg>
  );
}

/* ── Heart ────────────────────────────────────────────────────────────── */

export function IlloHeart({ tone = "orange", label, className, ...props }: IlloProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} {...svgA11y(label)} {...props}>
      <path
        d="M32 56C18 45.5 6 35.6 6 22.9 6 13.8 13 7 21.4 7c4.3 0 8.3 1.9 10.6 5.1C34.3 8.9 38.3 7 42.6 7 51 7 58 13.8 58 22.9 58 35.6 46 45.5 32 56Z"
        fill={TONE[tone]}
      />
    </svg>
  );
}

/* ── Mouse toy ────────────────────────────────────────────────────────── */

export function IlloMouse({ tone = "sage", label, className, ...props }: IlloProps) {
  const body = TONE[tone];
  const isDark = tone === "green" || tone === "sage" || tone === "leaf";
  const ear = isDark ? "hsl(var(--sage) / 0.65)" : "hsl(0 0% 100% / 0.75)";
  const eye = isDark ? "hsl(165 45% 8%)" : "hsl(165 45% 12%)";
  const nose = "hsl(var(--accent))";
  const tail = isDark ? "hsl(var(--sage) / 0.8)" : "hsl(var(--peach))";
  return (
    <svg viewBox="0 0 96 64" fill="none" className={className} {...svgA11y(label)} {...props}>
      {/* curly tail */}
      <path
        d="M66 40c8 6 16 8 20-1 3-7-3-12-8-10"
        stroke={tail}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* teardrop body, nose pointing left */}
      <path
        d="M5.5 38.5C13 24 30 12 47 12c14.5 0 24 10.4 24 22 0 10.6-8.8 18-21.5 18-18 0-36.5-6-43-10.2-1.6-1-1.8-2.3-1-3.3Z"
        fill={body}
      />
      {/* ear */}
      <circle cx="42" cy="21" r="8.5" fill={ear} />
      {/* eye + freckle */}
      <circle cx="26" cy="31" r="2.6" fill={eye} />
      <circle cx="36" cy="40" r="1.7" fill={nose} opacity="0.9" />
      {/* nose tip */}
      <ellipse cx="7.5" cy="37.5" rx="3.4" ry="2.8" fill={isDark ? nose : "hsl(var(--leaf))"} />
    </svg>
  );
}

/* ── Sitting cat ──────────────────────────────────────────────────────── */

export function IlloCat({ tone = "green", label, className, ...props }: IlloProps) {
  const body = TONE[tone];
  const face = tone === "butter" || tone === "cream" ? "hsl(165 45% 12%)" : "hsl(40 50% 98%)";
  return (
    <svg viewBox="0 0 96 112" fill="none" className={className} {...svgA11y(label)} {...props}>
      {/* tail — curls out from the base */}
      <path
        d="M70 96c12 2 20-4 20-14 0-7-4-11-8-13"
        stroke={body}
        strokeWidth="9"
        strokeLinecap="round"
      />
      {/* ears */}
      <path d="M22 26 26 4l16 12Z" fill={body} />
      <path d="M74 26 70 4 54 16Z" fill={body} />
      {/* head */}
      <circle cx="48" cy="34" r="26" fill={body} />
      {/* body */}
      <path
        d="M28 104c-2-22 4-46 20-46s22 24 20 46c-.2 2.4-2 4-4.4 4H32.4c-2.4 0-4.2-1.6-4.4-4Z"
        fill={body}
      />
      {/* front legs — subtle separations */}
      <path d="M41 108V78" stroke={face} strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
      <path d="M55 108V78" stroke={face} strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
      {/* whiskers */}
      <path d="M6 32h14M6 40h13" stroke={body} strokeWidth="3" strokeLinecap="round" />
      <path d="M90 32H76M90 40h-13" stroke={body} strokeWidth="3" strokeLinecap="round" />
      {/* face */}
      <circle cx="38" cy="31" r="3.6" fill={face} />
      <circle cx="58" cy="31" r="3.6" fill={face} />
      <path
        d="M44 41c1.2 1.6 2.6 2.4 4 2.4s2.8-.8 4-2.4"
        stroke={face}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M48 38v3" stroke={face} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/* ── Cat-food tin ─────────────────────────────────────────────────────── */

export function IlloCan({ tone = "pink", label, className, ...props }: IlloProps) {
  const body = TONE[tone];
  const isDark = tone === "green" || tone === "leaf";
  const lid = isDark ? "hsl(0 0% 100% / 0.25)" : "hsl(0 0% 100% / 0.6)";
  const text = isDark ? "hsl(40 50% 96%)" : "hsl(0 0% 100%)";
  const fish = isDark ? "hsl(var(--accent))" : tone === "pink" ? "hsl(var(--primary))" : "hsl(var(--accent))";
  return (
    <svg viewBox="0 0 80 96" fill="none" className={className} {...svgA11y(label)} {...props}>
      {/* can body */}
      <path d="M8 14h64v66c0 6.6-14.3 12-32 12S8 86.6 8 80V14Z" fill={body} />
      {/* lid */}
      <ellipse cx="40" cy="14" rx="32" ry="11" fill={body} />
      <ellipse cx="40" cy="13" rx="24" ry="7" fill={lid} />
      <ellipse cx="40" cy="12.5" rx="10" ry="2.6" fill={body} opacity="0.7" />
      {/* label */}
      <text
        x="40"
        y="46"
        textAnchor="middle"
        fill={text}
        fontFamily="var(--font-sans)"
        fontWeight="800"
        fontSize="13.5"
        letterSpacing="0.4"
      >
        CAT
      </text>
      <text
        x="40"
        y="60"
        textAnchor="middle"
        fill={text}
        fontFamily="var(--font-sans)"
        fontWeight="800"
        fontSize="13.5"
        letterSpacing="0.4"
      >
        FOOD
      </text>
      {/* fish */}
      <path
        d="M24 76c4.5-4.6 11-7 17-7 5 0 9.4 1.7 12 4.6-2.6 2.9-7 4.6-12 4.6-6 0-12.5-2.4-17-2.2Z"
        fill={fish}
      />
      <path d="M53 73.6 60 69v9.2Z" fill={fish} />
      <circle cx="30" cy="73" r="1.4" fill={body} />
    </svg>
  );
}

/* ── Leafy sprig ──────────────────────────────────────────────────────── */

export function IlloSprig({ tone = "leaf", label, className, ...props }: IlloProps) {
  const fill = TONE[tone];
  return (
    <svg viewBox="0 0 64 96" fill="none" className={className} {...svgA11y(label)} {...props}>
      <path d="M14 92C26 70 40 40 54 10" stroke={fill} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="50" cy="14" rx="6.5" ry="11" transform="rotate(24 50 14)" fill={fill} />
      <ellipse cx="30" cy="30" rx="6" ry="10" transform="rotate(-38 30 30)" fill={fill} />
      <ellipse cx="52" cy="40" rx="6" ry="10" transform="rotate(52 52 40)" fill={fill} />
      <ellipse cx="22" cy="56" rx="5.5" ry="9.5" transform="rotate(-44 22 56)" fill={fill} />
      <ellipse cx="42" cy="66" rx="5.5" ry="9.5" transform="rotate(58 42 66)" fill={fill} />
    </svg>
  );
}

/* ── Little fish ──────────────────────────────────────────────────────── */

export function IlloFish({ tone = "orange", label, className, ...props }: IlloProps) {
  const fill = TONE[tone];
  return (
    <svg viewBox="0 0 96 48" fill="none" className={className} {...svgA11y(label)} {...props}>
      <path
        d="M8 24C16 13 30 6 44 6c16 0 28 8 32 18-4 10-16 18-32 18C30 42 16 35 8 24Z"
        fill={fill}
      />
      <path d="M74 24 92 10v28Z" fill={fill} />
      <circle cx="24" cy="20" r="3" fill="hsl(40 50% 98%)" />
    </svg>
  );
}

/* ── Composition helpers ──────────────────────────────────────────────── */

/**
 * Sticker — places an illustration with a gentle rotation and an optional
 * slow float, like a sticker pressed onto the page. Purely decorative.
 */
export function Sticker({
  children,
  rotate = -6,
  float,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  rotate?: number;
  float?: boolean;
  delay?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute select-none", float && "animate-float", className)}
      style={{ transform: `rotate(${rotate}deg)`, animationDelay: delay ? `${delay}s` : undefined }}
    >
      {children}
    </span>
  );
}

/**
 * PawTrail — a line of paw steps walking across the page, left-right
 * alternating like a real gait, fading as they go. Decorative connective
 * tissue between sections.
 */
export function PawTrail({
  steps = 5,
  tone = "peach",
  className,
}: {
  steps?: number;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none flex items-end gap-5 select-none", className)}>
      {Array.from({ length: steps }).map((_, i) => (
        <IlloPaw
          key={i}
          tone={tone}
          className={cn("size-5 shrink-0", i % 2 ? "translate-y-0 rotate-[18deg]" : "-translate-y-2 rotate-[6deg]")}
          style={{ opacity: 1 - i * (0.65 / Math.max(steps - 1, 1)) }}
        />
      ))}
    </div>
  );
}
