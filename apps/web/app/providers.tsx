"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@moraqat/ui";
import { dict, type Locale } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { CookieConsent } from "@/components/cookie-consent";

type Dictionary = (typeof dict)[Locale];
type LocaleCtx = { locale: Locale; setLocale: (l: Locale) => void; t: Dictionary };
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
    () => ({ locale, setLocale, t: dict[locale] }),
    [locale, setLocale]
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <LocaleContext.Provider value={value}>
              {children}
              <CookieConsent />
            </LocaleContext.Provider>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
