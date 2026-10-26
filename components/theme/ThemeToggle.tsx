"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme-storage-key";
import { applyBrowserChromeColor, browserChromeColor } from "@/lib/theme/browser-chrome";
import { IconMoon, IconSun } from "@/components/icons/HeaderIcons";
import { useI18n } from "@/components/i18n/I18nProvider";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    setTheme(current);
    setMounted(true);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    const canvas = document.documentElement.getAttribute("data-canvas");
    applyBrowserChromeColor(
      browserChromeColor(next, canvas === "landing" ? "landing" : null)
    );
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Stockage indisponible : bascule session uniquement.
    }
  }

  const label = mounted
    ? theme === "dark"
      ? t("chrome.theme.toLight")
      : t("chrome.theme.toDark")
    : t("chrome.theme.toggle");

  return (
    <button type="button" onClick={toggleTheme} aria-label={label} title={label} className="ob-icon-btn">
      {mounted ? theme === "dark" ? <IconSun size={15} /> : <IconMoon size={15} /> : <IconMoon size={15} />}
    </button>
  );
}
