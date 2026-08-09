// ═══════════════════════════════════════════════════════════════════════════
// Palette DÉDIÉE à la landing page — étape 10, exception scoped à `/` UNIQUEMENT
// ═══════════════════════════════════════════════════════════════════════════
// Cf. .cursor/rules/brvm-non-negotiable.mdc § "Exception explicite — Landing
// page" : cette palette reproduit visuellement `ouestbourse.com` (tons bruns/
// noirs chauds, accent orangé) et N'EST PAS partagée avec le reste de
// l'application, qui garde la palette `lib/theme/colors.ts` (sombre/or).
// ═══════════════════════════════════════════════════════════════════════════

export const LC = {
  bg: "#0E0B08",
  bgAlt: "#161009",
  panel: "#1B140D",
  panelAlt: "#221A11",
  border: "#2E2417",
  accent: "#D08A3E",
  accentDim: "#8A5A28",
  cream: "#F5F0E6",
  text: "#EDE6D8",
  textDim: "#A79A87",
  green: "#7FBF7F",
} as const;

export const LANDING_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const LANDING_SERIF = "Georgia, 'Times New Roman', serif";
