import { cn } from "@moraqat/ui";

/**
 * Twinkling four-point glints scattered over a marketing surface (homepage
 * "glitter", 2026-10-02). Purely decorative: aria-hidden, pointer-events off,
 * positions are fixed per preset so server and client render identically.
 * Under reduced motion they hold still (see `.sparkle` in globals.css).
 */

type Glint = { top: string; left: string; size: number; delay: number; dur: number; tone: "gold" | "accent" | "primary" | "white" };

const PRESETS: Record<"hero" | "panel" | "band", Glint[]> = {
  hero: [
    { top: "8%", left: "6%", size: 18, delay: 0, dur: 3.4, tone: "gold" },
    { top: "18%", left: "44%", size: 12, delay: 1.1, dur: 2.8, tone: "accent" },
    { top: "12%", left: "88%", size: 22, delay: 0.5, dur: 3.8, tone: "gold" },
    { top: "46%", left: "94%", size: 12, delay: 1.9, dur: 3.0, tone: "primary" },
    { top: "70%", left: "52%", size: 14, delay: 0.8, dur: 3.6, tone: "gold" },
    { top: "82%", left: "8%", size: 16, delay: 2.3, dur: 3.2, tone: "accent" },
    { top: "38%", left: "2%", size: 10, delay: 1.5, dur: 2.6, tone: "gold" },
    { top: "88%", left: "84%", size: 12, delay: 0.3, dur: 3.1, tone: "primary" },
  ],
  panel: [
    { top: "10%", left: "8%", size: 16, delay: 0.2, dur: 3.3, tone: "gold" },
    { top: "16%", left: "86%", size: 12, delay: 1.4, dur: 2.9, tone: "accent" },
    { top: "78%", left: "90%", size: 18, delay: 0.7, dur: 3.7, tone: "gold" },
    { top: "84%", left: "12%", size: 11, delay: 2.0, dur: 3.0, tone: "primary" },
  ],
  band: [
    { top: "14%", left: "10%", size: 14, delay: 0.4, dur: 3.2, tone: "white" },
    { top: "22%", left: "78%", size: 18, delay: 1.2, dur: 3.6, tone: "gold" },
    { top: "76%", left: "60%", size: 12, delay: 2.1, dur: 2.8, tone: "white" },
    { top: "68%", left: "4%", size: 10, delay: 0.9, dur: 3.0, tone: "gold" },
  ],
};

const FILL: Record<Glint["tone"], string> = {
  gold: "hsl(42 95% 58%)",
  accent: "hsl(var(--accent))",
  primary: "hsl(var(--primary) / 0.7)",
  white: "hsl(0 0% 100% / 0.9)",
};

export function Sparkles({ preset = "hero", className }: { preset?: keyof typeof PRESETS; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {PRESETS[preset].map((g, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={g.size}
          height={g.size}
          className="sparkle absolute"
          style={{ top: g.top, left: g.left, ["--sparkle-delay" as string]: `${g.delay}s`, ["--sparkle-dur" as string]: `${g.dur}s` }}
        >
          <path d="M12 0c.9 6.6 4.5 10.2 12 12-7.5 1.8-11.1 5.4-12 12-.9-6.6-4.5-10.2-12-12C7.5 10.2 11.1 6.6 12 0z" fill={FILL[g.tone]} />
        </svg>
      ))}
    </div>
  );
}
