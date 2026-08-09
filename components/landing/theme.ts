// ═══════════════════════════════════════════════════════════════════════════
// Palette du HERO de la landing page — étape 11 (rebranding ouestBourse)
// ═══════════════════════════════════════════════════════════════════════════
// Historique : à l'étape 10, toute la landing page utilisait une palette
// sombre dédiée (brun/orangé, approximative — aucune capture réelle
// disponible à ce moment-là). Depuis l'étape 11 (capture réelle fournie par
// l'utilisateur), le header et le reste du site utilisent la palette CLAIRE
// partagée (`lib/theme/colors.ts`) — seule la section HERO de la landing
// reste sombre (fond photo/dégradé foncé, comme sur la capture), avec des
// teintes vert forêt/or cohérentes avec le logo réel `public/logo.png`
// plutôt que le brun approximatif d'origine.
// ═══════════════════════════════════════════════════════════════════════════

export const LC = {
  bg: "#0A1B12",
  bgAlt: "#0D2116",
  panel: "#12281A",
  panelAlt: "#173225",
  border: "#254733",
  accent: "#D9A441",
  accentDim: "#8A6A2C",
  cream: "#F5F1E6",
  text: "#E7EFE9",
  textDim: "#9FB3A5",
  green: "#4ADE80",
} as const;

export const LANDING_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const LANDING_SERIF = "Georgia, 'Times New Roman', serif";
