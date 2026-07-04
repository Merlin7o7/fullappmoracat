import type { Config } from "tailwindcss";

/**
 * Moraqat shared Tailwind preset — the single source of design truth.
 * Colours are declared as HSL CSS variables in globals.css so light/dark
 * and future theming swap without recompiling. Inspired by Apple / Stripe /
 * Linear: restrained palette, generous spacing, soft shadows, crisp type.
 */
const preset: Partial<Config> = {
  darkMode: ["class"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      // 13 is absent from Tailwind's default scale; the design system relies on
      // it for large controls (h-13 buttons/inputs). Define it once → craft.
      spacing: { 13: "3.25rem" },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        // Sticker accents — decorative family from the brand illustration set.
        cream: {
          DEFAULT: "hsl(var(--cream))",
          foreground: "hsl(var(--cream-foreground))",
        },
        sage: "hsl(var(--sage))",
        butter: "hsl(var(--butter))",
        peach: "hsl(var(--peach))",
        blush: "hsl(var(--blush))",
        leaf: "hsl(var(--leaf))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 12px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        arabic: ["var(--font-arabic)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      fontSize: {
        // Type scale with paired line-heights + tracking (display is tighter).
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.35rem" }],
        base: ["1rem", { lineHeight: "1.65rem" }],
        lg: ["1.125rem", { lineHeight: "1.7rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em" }],
        "2xl": ["1.5rem", { lineHeight: "1.95rem", letterSpacing: "-0.015em" }],
        "3xl": ["1.9rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em" }],
        "4xl": ["2.4rem", { lineHeight: "2.6rem", letterSpacing: "-0.025em" }],
        "5xl": ["3.15rem", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        "6xl": ["3.85rem", { lineHeight: "1.02", letterSpacing: "-0.035em" }],
        "7xl": ["4.75rem", { lineHeight: "1", letterSpacing: "-0.04em" }],
      },
      boxShadow: {
        // Consistent elevation ladder (mapped to CSS vars → theme-aware).
        e1: "var(--elevation-1)",
        e2: "var(--elevation-2)",
        e3: "var(--elevation-3)",
        soft: "var(--elevation-1)",
        "soft-lg": "var(--elevation-2)",
        glass: "0 8px 32px -8px hsl(var(--shadow-color) / 0.28), inset 0 1px 0 0 rgb(255 255 255 / 0.12)",
        glow: "0 0 0 1px hsl(var(--primary) / 0.25), 0 10px 34px -8px hsl(var(--primary) / 0.4)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        spring: "var(--ease-spring)",
      },
      backdropBlur: { xs: "2px" },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-up": {
          "0%": { opacity: "0", transform: "translateY(100%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--primary) / 0.35)" },
          "50%": { boxShadow: "0 0 0 8px hsl(var(--primary) / 0)" },
        },
        // Benefits ribbon — translates by exactly half (content is doubled).
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "marquee-rtl": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(50%)" },
        },
        // Affectionate sticker wobble (entrances, hover accents).
        wiggle: {
          "0%, 100%": { transform: "rotate(-2.5deg)" },
          "50%": { transform: "rotate(2.5deg)" },
        },
        // The footer cat's tail / walking bob.
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s var(--ease-out) both",
        "fade-in": "fade-in 0.5s var(--ease-out) both",
        "scale-in": "scale-in 0.4s var(--ease-out) both",
        "slide-in-up": "slide-in-up 0.35s var(--ease-out) both",
        shimmer: "shimmer 1.8s infinite",
        float: "float 7s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2.2s ease-in-out infinite",
        marquee: "marquee 36s linear infinite",
        "marquee-rtl": "marquee-rtl 36s linear infinite",
        wiggle: "wiggle 2.6s ease-in-out infinite",
        bob: "bob 1.1s ease-in-out infinite",
      },
    },
  },
};

export default preset;
