"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@moraqat/ui";
import { dict, type Locale } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { type CalendarPref, CALENDAR_STORAGE_KEY, setCurrentCalendar } from "@/lib/datetime";

type Dictionary = (typeof dict)[Locale];
type LocaleCtx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dictionary;
  /** Date-calendar preference (auto = Hijri for Arabic, Gregorian for English). */
  calendar: CalendarPref;
  setCalendar: (c: CalendarPref) => void;
};
const LocaleContext = React.createContext<LocaleCtx | null>(null);

export function useLocale() {
  const ctx = React.useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within Providers");
  return ctx;
}

export function Providers({
  children,
  initialLocale = "ar",
}: {
  children: React.ReactNode;
  /** Locale resolved server-side from the cookie so the first paint is correct —
   *  no flash of Arabic RTL for English members (R102). */
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = React.useState<Locale>(initialLocale);
  // Calendar starts at "auto" (matches SSR); the persisted choice is applied on
  // mount, so there's no hydration mismatch — only an override re-renders dates.
  const [calendar, setCalendarState] = React.useState<CalendarPref>("auto");
  const [queryClient] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } })
  );

  const setLocale = React.useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem("moraqat.locale", l);
    } catch {
      /* storage unavailable — the cookie below is the source of truth */
    }
    // The server reads this cookie on the next request to emit <html lang/dir>
    // correctly — this is what makes the locale SSR-correct, not client-only.
    document.cookie = `locale=${l}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);

  const setCalendar = React.useCallback((c: CalendarPref) => {
    setCalendarState(c);
    setCurrentCalendar(c); // update the shared formatter singleton immediately
    try {
      localStorage.setItem(CALENDAR_STORAGE_KEY, c);
    } catch {
      /* storage unavailable */
    }
    if (typeof document !== "undefined") document.documentElement.dataset.calendar = c;
  }, []);

  // Apply the persisted calendar preference on mount.
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(CALENDAR_STORAGE_KEY) as CalendarPref | null;
      if (stored === "auto" || stored === "gregorian" || stored === "hijri") setCalendar(stored);
    } catch {
      /* ignore */
    }
  }, [setCalendar]);

  // Keep <html> in sync for instant client switches without a reload.
  React.useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dict[locale].dir;
  }, [locale]);

  // Client-side error tracking — loaded only when a DSN is configured, so it
  // adds nothing to the bundle payload for unconfigured/dev environments.
  React.useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.init({ dsn, environment: process.env.NODE_ENV, tracesSampleRate: 0.1 });
    });
  }, []);

  const value = React.useMemo<LocaleCtx>(
    () => ({ locale, setLocale, t: dict[locale], calendar, setCalendar }),
    [locale, setLocale, calendar, setCalendar]
  );

  return (
    // reducedMotion="user" makes EVERY framer-motion animation honour
    // prefers-reduced-motion globally (R075) — including whileInView entrances
    // the CSS reduced-motion rule can't reach (transforms, not CSS animations).
    <MotionConfig reducedMotion="user">
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <LocaleContext.Provider value={value}>
                {children}
                {/* Consent is now a single surface: the analytics ConsentBanner
                    (mounted in layout.tsx) is the meaningful opt-in — accept turns
                    analytics on, decline keeps the site on essential storage only.
                    The old "no ad trackers" cookie notice was retired because it
                    would contradict the pixels the moment they ship (R040). */}
              </LocaleContext.Provider>
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
