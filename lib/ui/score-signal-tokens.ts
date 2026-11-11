// Code couleur unique, du vert (bon) au rouge (moins bon), pour le score,
// le signal et la confiance. Les trois indicateurs partagent les mêmes jetons ;
// seuls la forme et le libellé restent distincts, pour rester lisibles
// sans la couleur (daltonisme).
// Les couleurs de texte « light » visent un contraste WCAG AA (≥ 4,5:1) sur fond clair,
// les « dark » sur le fond sombre de l'application (vérifié par les tests).

export type SignalLabel = "ACHAT FORT" | "ACHAT" | "CONSERVER" | "ALLÉGER" | "VENDRE";
export type ScoreTier = "excellent" | "good" | "average" | "weak";
export type SignalFamily = "buy" | "hold" | "sell";
export type ConfidenceLevel = "Élevée" | "Moyenne" | "Faible";
export type TrafficLight = "green" | "lime" | "amber" | "orange" | "red";

export interface ColorToken {
  /** Texte sur fond clair. */
  fg: string;
  /** Texte sur fond sombre. */
  fgDark: string;
  /** Fond de pastille (translucide, fonctionne dans les deux thèmes). */
  bg: string;
}

/** Échelle partagée : vert → vert clair → ambre → orange → rouge. */
export const TRAFFIC_LIGHT_TOKENS: Record<TrafficLight, ColorToken & { accent: string }> = {
  green: { fg: "#166534", fgDark: "#86efac", bg: "rgba(34, 197, 94, 0.24)", accent: "#22C55E" },
  lime: { fg: "#3f6212", fgDark: "#bef264", bg: "rgba(132, 204, 22, 0.16)", accent: "#84CC16" },
  amber: { fg: "#92400e", fgDark: "#fcd34d", bg: "rgba(245, 158, 11, 0.16)", accent: "#F59E0B" },
  orange: { fg: "#9a3412", fgDark: "#fdba74", bg: "rgba(249, 115, 22, 0.16)", accent: "#F97316" },
  red: { fg: "#b91c1c", fgDark: "#fca5a5", bg: "rgba(239, 68, 68, 0.14)", accent: "#EF4444" },
};

function paint(light: TrafficLight): ColorToken {
  const { fg, fgDark, bg } = TRAFFIC_LIGHT_TOKENS[light];
  return { fg, fgDark, bg };
}

/** Paliers du score, du plus haut au plus bas (bornes incluses). */
export const SCORE_TIERS: ReadonlyArray<{ tier: ScoreTier; min: number; labelFr: string; labelEn: string }> = [
  { tier: "excellent", min: 70, labelFr: "Excellent", labelEn: "Excellent" },
  { tier: "good", min: 55, labelFr: "Bon", labelEn: "Good" },
  { tier: "average", min: 40, labelFr: "Moyen", labelEn: "Average" },
  { tier: "weak", min: -Infinity, labelFr: "Faible", labelEn: "Weak" },
];

export const SCORE_TIER_LIGHT: Record<ScoreTier, TrafficLight> = {
  excellent: "green",
  good: "lime",
  average: "amber",
  weak: "red",
};

export const SCORE_TIER_TOKENS: Record<ScoreTier, ColorToken> = {
  excellent: paint("green"),
  good: paint("lime"),
  average: paint("amber"),
  weak: paint("red"),
};

export const SIGNAL_LIGHT: Record<SignalLabel, TrafficLight> = {
  "ACHAT FORT": "green",
  ACHAT: "lime",
  CONSERVER: "amber",
  ALLÉGER: "orange",
  VENDRE: "red",
};

export const SIGNAL_TOKENS: Record<SignalLabel, ColorToken & { family: SignalFamily; icon: string }> = {
  "ACHAT FORT": { ...paint("green"), family: "buy", icon: "▲" },
  ACHAT: { ...paint("lime"), family: "buy", icon: "▲" },
  CONSERVER: { ...paint("amber"), family: "hold", icon: "●" },
  ALLÉGER: { ...paint("orange"), family: "sell", icon: "▼" },
  VENDRE: { ...paint("red"), family: "sell", icon: "▼" },
};

/** Couleur « vive » d'un signal (graphiques, bordures) — même jeton que la pastille. */
export const SIGNAL_ACCENT: Record<SignalLabel, string> = {
  "ACHAT FORT": TRAFFIC_LIGHT_TOKENS.green.accent,
  ACHAT: TRAFFIC_LIGHT_TOKENS.lime.accent,
  CONSERVER: TRAFFIC_LIGHT_TOKENS.amber.accent,
  ALLÉGER: TRAFFIC_LIGHT_TOKENS.orange.accent,
  VENDRE: TRAFFIC_LIGHT_TOKENS.red.accent,
};

export const CONFIDENCE_LIGHT: Record<ConfidenceLevel, TrafficLight> = {
  Élevée: "green",
  Moyenne: "amber",
  Faible: "red",
};

export const CONFIDENCE_TOKENS: Record<ConfidenceLevel, ColorToken> = {
  Élevée: paint("green"),
  Moyenne: paint("amber"),
  Faible: paint("red"),
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

export function isConfidenceLevel(value: unknown): value is ConfidenceLevel {
  return value === "Élevée" || value === "Moyenne" || value === "Faible";
}

export function confidenceToken(value: string | null | undefined): ColorToken | null {
  return isConfidenceLevel(value) ? CONFIDENCE_TOKENS[value] : null;
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
