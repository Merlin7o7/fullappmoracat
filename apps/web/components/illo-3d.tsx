import Image from "next/image";
import { cn } from "@moraqat/ui";

/**
 * Moracat's 3D brand objects — the HERO tier of the illustration system.
 *
 * Two finishes of the same characters the flat sticker set already uses
 * (cat, mouse, can, heart, fish, paw, leaf):
 *   · plush — stitched fabric, warm and tactile: the light theme's voice.
 *   · metal — satin green / copper: the dark theme's voice.
 * `finish="auto"` (default) shows plush on light and metal on dark wherever
 * both exist, so a screen never has to choose.
 *
 * Usage rules (brand):
 *   1. One 3D object per screen, at 64 px or larger — empty states, 404/error,
 *      welcomes, celebrations. Below that size use the flat stickers in
 *      `illustrations.tsx`; 3D turns muddy when small.
 *   2. Never recolour, outline, crop or put text on an object. Tint the ground
 *      behind it instead (cream / sage / butter / peach / blush).
 *   3. Decorative by default (`aria-hidden`). Pass `label` only when the
 *      object carries meaning on its own.
 *   4. Motion is a gentle float or bob at most; reduced-motion is honoured
 *      globally.
 *
 * Source renders: 2000 px transparent PNGs (kept by the founder); the files in
 * /public/brand/3d are cropped, squared 1024 px WebPs — next/image serves the
 * size each placement needs.
 */

export type Illo3DName = "cat" | "mouse" | "can" | "heart" | "fish" | "paw" | "leaf";
export type Illo3DFinish = "auto" | "plush" | "metal";

const FILES: Record<Illo3DName, { plush?: string; metal?: string }> = {
  cat: { plush: "cat-plush", metal: "cat-metal" },
  mouse: { plush: "mouse-plush-pink", metal: "mouse-metal" },
  can: { plush: "can-plush", metal: "can-metal" },
  heart: { plush: "heart-plush", metal: "heart-metal" },
  fish: { plush: "fish-plush" },
  paw: { plush: "paw-plush" },
  leaf: { metal: "leaf-metal" },
};

/** Alternate plush colourways (same object, different cloth). */
const VARIANTS: Partial<Record<Illo3DName, Record<string, string>>> = {
  mouse: { green: "mouse-plush-green", pink: "mouse-plush-pink" },
};

export interface Illo3DProps {
  name: Illo3DName;
  finish?: Illo3DFinish;
  /** Plush colourway where one exists (mouse: "pink" | "green"). */
  variant?: string;
  /** Rendered CSS size in px — tells next/image which file size to serve. */
  px?: number;
  /** Box size + animation classes, e.g. "size-28 animate-float". */
  className?: string;
  /** Soft contact shadow so the object sits on the page instead of floating in it. */
  shadow?: boolean;
  /** Mirror in RTL for objects that face a direction (mouse, fish, leaf). */
  directional?: boolean;
  /** Accessible name. Omit for decoration (the default). */
  label?: string;
  /** Above-the-fold hero: load eagerly. */
  priority?: boolean;
}

const src = (file: string) => `/brand/3d/${file}.webp`;

export function Illo3D({
  name,
  finish = "auto",
  variant,
  px = 128,
  className,
  shadow = true,
  directional = false,
  label,
  priority = false,
}: Illo3DProps) {
  const files = FILES[name];
  const plush = (variant && VARIANTS[name]?.[variant]) || files.plush;
  const metal = files.metal;

  // Resolve what each theme shows; fall back to whichever finish exists.
  const light = finish === "metal" ? (metal ?? plush) : (plush ?? metal);
  const dark = finish === "plush" ? (plush ?? metal) : (metal ?? plush);
  const same = light === dark;

  const img = (file: string, themeClass?: string) => (
    <Image
      src={src(file)}
      alt={label ?? ""}
      fill
      sizes={`${px}px`}
      priority={priority}
      draggable={false}
      className={cn("select-none object-contain", directional && "rtl:-scale-x-100", themeClass)}
    />
  );

  return (
    <span
      className={cn("relative inline-block size-28 shrink-0", className)}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {shadow && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-[16%] bottom-[1%] h-[7%] rounded-[50%] bg-foreground/15 blur-md dark:bg-black/50"
        />
      )}
      {same ? (
        img(light!)
      ) : (
        <>
          {img(light!, "dark:hidden")}
          {img(dark!, "hidden dark:block")}
        </>
      )}
    </span>
  );
}
