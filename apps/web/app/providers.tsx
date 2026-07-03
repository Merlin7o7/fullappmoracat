"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@moraqat/ui";
import { dict, type Locale } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";

type Dictionary = (typeof dict)[Locale];
type LocaleCtx = { locale: Locale; setLocale: (l: Locale) => void; t: Dictionary };
const LocaleContext = React.createContext<LocaleCtx | null>(null);

export function useLocale() {
  const ctx = React.useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within Providers");
  return ctx;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>("ar");
  const [queryClient] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } })
  );

  // Persist + reflect locale on <html> (dir/lang) for correct RTL.
  React.useEffect(() => {
    const saved = (localStorage.getItem("moraqat.locale") as Locale) || "ar";
    setLocaleState(saved);
  }, []);

  const setLocale = React.useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("moraqat.locale", l);
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dict[locale].dir;
  }, [locale]);

  const value = React.useMemo<LocaleCtx>(
    () => ({ locale, setLocale, t: dict[locale] }),
    [locale, setLocale]
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
