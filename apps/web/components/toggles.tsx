"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Languages } from "lucide-react";
import { Button } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import * as React from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isAr ? (isDark ? "الوضع الفاتح" : "الوضع الداكن") : isDark ? "Light mode" : "Dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted && isDark ? <Sun /> : <Moon />}
    </Button>
  );
}

export function LangToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={locale === "ar" ? "التبديل إلى الإنجليزية" : "Switch to Arabic"}
      onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
    >
      <Languages className="size-4" />
      {locale === "ar" ? "EN" : "ع"}
    </Button>
  );
}
