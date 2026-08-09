// ═══════════════════════════════════════════════════════════════════════════
// Palette partagée du site — mise à jour "rebranding ouestBourse" (étape 11)
// ═══════════════════════════════════════════════════════════════════════════
// Historique : palette sombre/or d'origine (étape 10), remplacée le
// 09/08/2026 (soir) par une palette CLAIRE inspirée de la charte réelle
// ouestbourse.com (fond blanc, vert forêt, or/orange), à la demande explicite
// de l'utilisateur — cf. .cursor/rules/brvm-non-negotiable.mdc
// § "MISE À JOUR — Rebranding complet ouestBourse". Les NOMS des clés restent
// identiques (aucun usage existant cassé), seules les valeurs changent.
//
// Valeurs IDENTIQUES à l'objet `C` défini dans `components/BrvmDashboardClient.tsx`
// (dupliqué là-bas volontairement, cf. commentaire sur place — on ne veut
// STRICTEMENT RIEN changer à la STRUCTURE de ce composant déjà validé, sa
// palette suit désormais la même mise à jour de valeurs). Cette palette est
// partagée par toutes les pages (landing incluse depuis l'étape 11 — la
// palette dédiée `components/landing/theme.ts` de l'étape 10 est conservée
// pour compatibilité mais la landing utilise maintenant l'identité visuelle
// unifiée ci-dessous).
// ═══════════════════════════════════════════════════════════════════════════

export const C = {
  bg: "#FFFFFF",
  panel: "#F6F7F3",
  border: "#E2E5DD",
  gold: "#D9A441",
  green: "#1E7A42",
  red: "#DC2626",
  blue: "#2563EB",
  silver: "#94A3B8",
  text: "#16241B",
  textDim: "#5B6B60",
  teal: "#0D9488",
  purple: "#9333EA",
} as const;

export const FONT_FAMILY = "'Trebuchet MS', Georgia, serif";
