// ═══════════════════════════════════════════════════════════════════════════
// Palette du HERO landing — toile sombre premium (charbon / or / vert).
// Identité marketing figée : indépendante de la bascule clair/sombre du site.
// Les variables CSS `--lp-*` dans Landing.module.css sont la source appliquée.
// ═══════════════════════════════════════════════════════════════════════════

export const LC = {
  bg: "#05070b",
  bgAlt: "#0a0e14",
  panel: "rgba(16, 20, 28, 0.78)",
  panelAlt: "#131822",
  border: "rgba(212, 168, 67, 0.22)",
  accent: "#D4A843",
  accentDim: "#8A6A2C",
  cream: "#F3EAD8",
  text: "#F3EAD8",
  textDim: "#9AA3B2",
  green: "#22C55E",
} as const;

export const LANDING_SANS =
  'var(--font-inter), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const LANDING_SERIF = LANDING_SANS;
