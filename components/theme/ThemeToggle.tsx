"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Bascule mode clair/sombre — étape 12
// ═══════════════════════════════════════════════════════════════════════════
// Ne fait QUE lire/écrire l'attribut `data-theme` sur `<html>` (déjà posé
// avant hydratation par le script bloquant de `app/layout.tsx`, cf.
// commentaire là-bas) + persister le choix dans `localStorage`. Toute la
// mécanique de rethème réel vient des variables CSS de `app/globals.css`
// (`:root` vs `:root[data-theme="dark"]`) — ce composant ne connaît AUCUNE
// couleur, il ne fait que piloter l'attribut.
//
// `mounted` évite un hydration mismatch : le serveur ne peut pas savoir quel
// thème l'utilisateur avait choisi (localStorage n'existe pas côté serveur),
// donc le premier rendu (serveur ET client, avant l'effet) affiche toujours
// la même icône neutre ; l'icône réelle (soleil / lune) n'apparaît qu'après montage,
// une fois l'attribut réel de `<html>` lu.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { C } from "@/lib/theme/colors";
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
      // Stockage indisponible (navigation privée, quota) : la bascule reste
      // fonctionnelle pour la session en cours, simplement non persistée.
    }
  }

  const label = mounted ? (theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre") : "Bascule thème clair/sombre";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        background: "transparent",
        color: C.text,
        cursor: "pointer",
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {mounted ? (theme === "dark" ? <IconSun size={15} /> : <IconMoon size={15} />) : (
        <IconMoon size={15} />
      )}
    </button>
  );
}
