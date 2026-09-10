// ═══════════════════════════════════════════════════════════════════════════
// Palette partagée du site — bascule mode clair/sombre (étape 12)
// ═══════════════════════════════════════════════════════════════════════════
// Historique :
//   - Étape 10 : palette sombre/or d'origine (valeurs figées en dur).
//   - Étape 11 : remplacée par une palette CLAIRE "OuestBourse" (rebranding).
//   - Étape 12 (celle-ci) : les DEUX palettes existent maintenant en même
//     temps, comme variables CSS (`app/globals.css`, `:root` = claire,
//     `:root[data-theme="dark"]` = sombre = EXACTEMENT la palette d'origine
//     de `reference/BRVM_Dashboard.jsx`). `C` référence ces variables CSS
//     plutôt que des hex figés, pour que la bascule de thème
//     (`components/theme/ThemeToggle.tsx`) retheme INSTANTANÉMENT toute
//     l'app SANS re-render React — y compris les pages Server Component
//     (Screener, Sociétés cotées, etc.) dont le HTML est figé au moment du
//     rendu serveur. Les NOMS des clés restent identiques (aucun usage
//     existant cassé), seule la RÉSOLUTION de la valeur change (var() au
//     lieu d'un hex littéral).
//
// Valeurs IDENTIQUES à l'objet `C` défini dans `components/BrvmDashboardClient.tsx`
// (dupliqué là-bas volontairement, cf. commentaire sur place — on ne veut
// STRICTEMENT RIEN changer à la STRUCTURE de ce composant déjà validé).
// ═══════════════════════════════════════════════════════════════════════════

export const C = {
  bg: "var(--c-bg)",
  panel: "var(--c-panel)",
  border: "var(--c-border)",
  gold: "var(--c-gold)",
  goldDim: "var(--c-golddim)",
  green: "var(--c-green)",
  red: "var(--c-red)",
  blue: "var(--c-blue)",
  silver: "var(--c-silver)",
  text: "var(--c-text)",
  textDim: "var(--c-textdim)",
  /** Libellés Source / Synchronisé — contraste > textDim (AD-2026-08-22-001). */
  textMeta: "var(--c-text-meta)",
  teal: "var(--c-teal)",
  purple: "var(--c-purple)",
  /// Variantes semi-transparentes prêtes à l'emploi — remplacent les anciens
  /// motifs `${C.border}20` / `${C.green}30` / `${C.red}30` (concaténation
  /// d'un suffixe alpha hexadécimal sur une valeur hex) devenus invalides
  /// depuis que `C.xxx` est un `var(...)` et non plus un hex littéral.
  borderThin: "var(--c-border-thin)",
  greenSoft: "var(--c-green-soft)",
  redSoft: "var(--c-red-soft)",
  selectedBg: "var(--c-selected-bg)",
} as const;

import { FONT_SANS_STACK } from "@/lib/theme/fonts";

export const FONT_FAMILY = FONT_SANS_STACK;
