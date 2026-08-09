// ═══════════════════════════════════════════════════════════════════════════
// Palette partagée du dashboard BRVM App — étape 10 (navigation complète)
// ═══════════════════════════════════════════════════════════════════════════
// Valeurs IDENTIQUES à l'objet `C` défini dans `components/BrvmDashboardClient.tsx`
// (lui-même verbatim de `reference/BRVM_Dashboard.jsx`, palette non-négociable
// — cf. .cursor/rules/brvm-non-negotiable.mdc). Dupliqué ici volontairement
// plutôt qu'importé DEPUIS BrvmDashboardClient.tsx : on ne veut STRICTEMENT
// RIEN changer à ce composant déjà validé (contrainte "ne jamais casser un
// onglet déjà fonctionnel"), et cette palette doit maintenant être partagée
// par les nouvelles pages du menu (Screener, Portefeuille, Graphes, Sociétés
// cotées, Actualités, Outils, Connexion, Inscription, le header commun) sans
// dépendre d'un composant client existant.
//
// ⚠️ La landing page (`app/page.tsx` / `components/LandingPage.tsx`) N'UTILISE
// PAS cette palette : elle a sa propre palette dédiée (cf.
// `components/landing/theme.ts`), par exception explicite validée le
// 09/08/2026 (cf. règle non-négociable mise à jour).
// ═══════════════════════════════════════════════════════════════════════════

export const C = {
  bg: "#080B12",
  panel: "#0D1117",
  border: "#1C2333",
  gold: "#D4A843",
  green: "#22C55E",
  red: "#EF4444",
  blue: "#3B82F6",
  silver: "#94A3B8",
  text: "#E2D9C5",
  textDim: "#6B7280",
  teal: "#14B8A6",
  purple: "#A855F7",
} as const;

export const FONT_FAMILY = "'Trebuchet MS', Georgia, serif";
