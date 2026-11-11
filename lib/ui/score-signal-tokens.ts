// Code couleur unique pour le SCORE (qualité, 0–100) et le SIGNAL (timing technique).
// Les deux ne doivent jamais se confondre :
// - score  → échelle or / bleu par paliers, jamais vert ni rouge ;
// - signal → pastille avec icône : Acheter vert, Conserver ambre, Alléger orange, Vendre rouge ;
// - confiance → point discret (opacité), jamais une couleur de signal.
// Les couleurs de texte « light » visent un contraste WCAG AA (≥ 4,5:1) sur fond clair,
// les « dark » sur le fond sombre de l'application (vérifié par les tests).

export type SignalLabel = "ACHAT FORT" | "ACHAT" | "CONSERVER" | "ALLÉGER" | "VENDRE";
export type ScoreTier = "excellent" | "good" | "average" | "weak";
export type SignalFamily = "buy" | "hold" | "sell";
export type ConfidenceLevel = "Élevée" | "Moyenne" | "Faible";

export interface ColorToken {
  /** Texte sur fond clair. */
  fg: string;
  /** Texte sur fond sombre. */
  fgDark: string;
  /** Fond de pastille (translucide, fonctionne dans les deux thèmes). */
  bg: string;
}

/** Paliers du score, du plus haut au plus bas (bornes incluses). */
export const SCORE_TIERS: ReadonlyArray<{ tier: ScoreTier; min: number; labelFr: string; labelEn: string }> = [
  { tier: "excellent", min: 70, labelFr: "Excellent", labelEn: "Excellent" },
  { tier: "good", min: 55, labelFr: "Bon", labelEn: "Good" },
  { tier: "average", min: 40, labelFr: "Moyen", labelEn: "Average" },
  { tier: "weak", min: -Infinity, labelFr: "Faible", labelEn: "Weak" },
];

/** Or (haut de l'échelle) → bleu (bas de l'échelle). Aucun vert, aucun rouge. */
export const SCORE_TIER_TOKENS: Record<ScoreTier, ColorToken> = {
  excellent: { fg: "#7a5200", fgDark: "#f2c85b", bg: "rgba(201, 150, 46, 0.26)" },
  good: { fg: "#7c6224", fgDark: "#e6cf94", bg: "rgba(201, 150, 46, 0.12)" },
  average: { fg: "#1d4ed8", fgDark: "#93b4fd", bg: "rgba(29, 78, 216, 0.12)" },
  weak: { fg: "#3f4f6b", fgDark: "#b6c2d6", bg: "rgba(71, 85, 105, 0.14)" },
};

export const SIGNAL_TOKENS: Record<SignalLabel, ColorToken & { family: SignalFamily; icon: string }> = {
  "ACHAT FORT": { family: "buy", icon: "▲", fg: "#166534", fgDark: "#86efac", bg: "rgba(34, 197, 94, 0.24)" },
  ACHAT: { family: "buy", icon: "▲", fg: "#3f6212", fgDark: "#bef264", bg: "rgba(132, 204, 22, 0.16)" },
  CONSERVER: { family: "hold", icon: "●", fg: "#92400e", fgDark: "#fcd34d", bg: "rgba(245, 158, 11, 0.16)" },
  ALLÉGER: { family: "sell", icon: "▼", fg: "#9a3412", fgDark: "#fdba74", bg: "rgba(249, 115, 22, 0.16)" },
  VENDRE: { family: "sell", icon: "▼", fg: "#b91c1c", fgDark: "#fca5a5", bg: "rgba(239, 68, 68, 0.14)" },
};

/** Couleur « vive » d'un signal (graphiques, bordures) — même famille que la pastille. */
export const SIGNAL_ACCENT: Record<SignalLabel, string> = {
  "ACHAT FORT": "#22C55E",
  ACHAT: "#84CC16",
  CONSERVER: "#F59E0B",
  ALLÉGER: "#F97316",
  VENDRE: "#EF4444",
};

/** Opacité du point de confiance : plus la confiance est basse, plus il s'efface. */
export const CONFIDENCE_OPACITY: Record<ConfidenceLevel, number> = {
  Élevée: 1,
  Moyenne: 0.6,
  Faible: 0.3,
};

export function scoreTier(score: number | null | undefined): ScoreTier | null {
  if (score == null || !Number.isFinite(score)) return null;
  const s = Math.round(score);
  return SCORE_TIERS.find((t) => s >= t.min)!.tier;
}

export function scoreTierLabel(tier: ScoreTier, locale: "fr" | "en" = "fr"): string {
  const t = SCORE_TIERS.find((x) => x.tier === tier)!;
  return locale === "en" ? t.labelEn : t.labelFr;
}

export function isSignalLabel(label: unknown): label is SignalLabel {
  return typeof label === "string" && label in SIGNAL_TOKENS;
}

export function signalFamily(label: string | null | undefined): SignalFamily | null {
  return isSignalLabel(label) ? SIGNAL_TOKENS[label].family : null;
}

export function confidenceOpacity(value: string | null | undefined): number | null {
  if (value === "Élevée" || value === "Moyenne" || value === "Faible") return CONFIDENCE_OPACITY[value];
  return null;
}

// --- Contraste WCAG (utilisé par les tests pour garder les couleurs accessibles) ---
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (x) => x + x) : h, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
