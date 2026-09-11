"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme-storage-key";
import { IconMoon, IconSun } from "@/components/icons/HeaderIcons";

type Theme = "light" | "dark";

export default function ThemeToggle() {
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
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Stockage indisponible : bascule session uniquement.
    }
  }

  const label = mounted
    ? theme === "dark"
      ? "Passer en mode clair"
      : "Passer en mode sombre"
    : "Bascule thème clair/sombre";

  return (
    <button type="button" onClick={toggleTheme} aria-label={label} title={label} className="ob-icon-btn">
      {mounted ? theme === "dark" ? <IconSun size={15} /> : <IconMoon size={15} /> : <IconMoon size={15} />}
    </button>
  );
}
