"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Languages } from "lucide-react";
import { Button } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import * as React from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
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
      aria-label="Switch language"
      onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
    >
      <Languages className="size-4" />
      {locale === "ar" ? "EN" : "ع"}
    </Button>
  );
}
