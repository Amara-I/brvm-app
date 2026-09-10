// Analyse de risque multi-piliers (cahier LeyInvest / OuestBourse).
// Proxies calculables avec les données BRVM actuelles — pas de ratios bilan inventés.
// Score 0–100 : plus haut = plus risqué.

export type RiskTier = "Très faible" | "Faible" | "Modéré" | "Élevé" | "Très élevé";

export type RiskPillarKey = "marche" | "liquidite" | "fondamental" | "operationnel";

export interface RiskClosePoint {
  time: string;
  value: number;
  volume?: number | null;
}

export interface RiskAnalysisInput {
  years: number[];
  prices: Record<number, number>;
  dividends: Record<number, number>;
  per: number;
  mktcap?: number;
  sector?: string;
  /** Série de clôtures (journalière ou densifiée) pour drawdown / VaR / volume. */
  closes?: RiskClosePoint[];
  /** Volatilité annuelle moyenne déjà calculée (string "N/D" ou nombre). */
  volatilityPercent?: string;
  historyDepth?: number;
}

export interface RiskPillar {
  key: RiskPillarKey;
  label: string;
  /** Score 0–100 (plus haut = plus risqué). null = non évaluable. */
  score: number | null;
  weight: number;
  note: string;
}

export interface RiskAnalysis {
  riskScore: number;
  riskTier: RiskTier;
  pillars: RiskPillar[];
  summary: string;
  /** Max drawdown en % (positif), ou null. */
  maxDrawdownPercent: number | null;
  /** VaR 95 % empirique (perte, % positif), ou null si série trop courte. */
  var95Percent: number | null;
  /** VaR 99 % empirique. */
  var99Percent: number | null;
  /** Expected Shortfall / CVaR 95 % (moyenne des pertes au-delà de la VaR 95 %). */
  cvar95Percent: number | null;
}

const WEIGHTS = {
  marche: 0.35,
  liquidite: 0.25,
  fondamental: 0.25,
  operationnel: 0.15,
} as const;

/** Secteurs plus cycliques / sensibles → risque opérationnel plus élevé. */
const SECTOR_OP_RISK: Record<string, number> = {
  Énergie: 72,
  Energie: 72,
  Industrie: 62,
  "Conso. Discrétionnaire": 65,
  "Conso. Base": 48,
  Banques: 58,
  "Services Financiers": 58,
  Télécoms: 38,
  Telecoms: 38,
  "Services Publics": 35,
  Agriculture: 68,
  Distribution: 55,
};

function clamp100(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function riskTierFromScore(score: number): RiskTier {
  if (score < 20) return "Très faible";
  if (score < 40) return "Faible";
  if (score < 60) return "Modéré";
  if (score < 80) return "Élevé";
  return "Très élevé";
}

/** Max drawdown sur une série de clôtures (0–100+). */
export function computeMaxDrawdownPercent(closes: RiskClosePoint[]): number | null {
  const vals = closes.map((c) => c.value).filter((v) => v > 0);
  if (vals.length < 3) return null;
  let peak = vals[0]!;
  let maxDd = 0;
  for (const v of vals) {
    if (v > peak) peak = v;
    const dd = ((peak - v) / peak) * 100;
    if (dd > maxDd) maxDd = dd;
  }
  return Math.round(maxDd * 10) / 10;
}

/** VaR empirique à un quantile (ex. 0.05 → 95 %, 0.01 → 99 %). */
export function computeEmpiricalVar(closes: RiskClosePoint[], quantile = 0.05): number | null {
  const vals = closes.map((c) => c.value).filter((v) => v > 0);
  if (vals.length < 31) return null;
  const rets: number[] = [];
  for (let i = 1; i < vals.length; i++) {
    rets.push(((vals[i]! - vals[i - 1]!) / vals[i - 1]!) * 100);
  }
  rets.sort((a, b) => a - b);
  const idx = Math.max(0, Math.floor(quantile * (rets.length - 1)));
  const q = rets[idx]!;
  return Math.round(Math.max(0, -q) * 10) / 10;
}

/** VaR 95 % empirique (perte positive en %), exige ≥ 30 rendements. */
export function computeEmpiricalVar95(closes: RiskClosePoint[]): number | null {
  return computeEmpiricalVar(closes, 0.05);
}

export function computeEmpiricalVar99(closes: RiskClosePoint[]): number | null {
  return computeEmpiricalVar(closes, 0.01);
}

/** CVaR 95 % = moyenne des pertes au-delà du quantile 5 %. */
export function computeEmpiricalCvar95(closes: RiskClosePoint[]): number | null {
  const vals = closes.map((c) => c.value).filter((v) => v > 0);
  if (vals.length < 31) return null;
  const rets: number[] = [];
  for (let i = 1; i < vals.length; i++) {
    rets.push(((vals[i]! - vals[i - 1]!) / vals[i - 1]!) * 100);
  }
  rets.sort((a, b) => a - b);
  const cut = Math.max(1, Math.floor(0.05 * rets.length));
  const tail = rets.slice(0, cut);
  const mean = tail.reduce((a, b) => a + b, 0) / tail.length;
  return Math.round(Math.max(0, -mean) * 10) / 10;
}

function avgVolume(closes: RiskClosePoint[]): number | null {
  const vols = closes.map((c) => c.volume).filter((v): v is number => typeof v === "number" && v > 0);
  if (vols.length < 5) return null;
  return vols.reduce((a, b) => a + b, 0) / vols.length;
}

function marketPillar(
  volatilityPercent: string | undefined,
  closes: RiskClosePoint[] | undefined
): {
  score: number | null;
  note: string;
  maxDd: number | null;
  var95: number | null;
  var99: number | null;
  cvar95: number | null;
} {
  const vol = volatilityPercent && volatilityPercent !== "N/D" ? parseFloat(volatilityPercent) : NaN;
  const maxDd = closes?.length ? computeMaxDrawdownPercent(closes) : null;
  const var95 = closes?.length ? computeEmpiricalVar95(closes) : null;
  const var99 = closes?.length ? computeEmpiricalVar99(closes) : null;
  const cvar95 = closes?.length ? computeEmpiricalCvar95(closes) : null;

  const parts: number[] = [];
  const notes: string[] = [];

  if (Number.isFinite(vol)) {
    const volScore = vol < 8 ? 18 : vol < 12 ? 32 : vol < 18 ? 48 : vol < 28 ? 68 : 85;
    parts.push(volScore);
    notes.push(`volatilité annuelle ${vol.toFixed(1).replace(".", ",")} %`);
  }
  if (maxDd != null) {
    const ddScore = maxDd < 15 ? 22 : maxDd < 30 ? 40 : maxDd < 45 ? 58 : maxDd < 60 ? 75 : 90;
    parts.push(ddScore);
    notes.push(`drawdown max ${maxDd.toFixed(1).replace(".", ",")} %`);
  }
  if (var95 != null) {
    const varScore = var95 < 1.5 ? 25 : var95 < 3 ? 42 : var95 < 5 ? 58 : var95 < 8 ? 72 : 88;
    parts.push(varScore);
    notes.push(`VaR 95 % ≈ ${var95.toFixed(1).replace(".", ",")} %`);
  }
  if (cvar95 != null) {
    const cvarScore = cvar95 < 2 ? 28 : cvar95 < 4 ? 45 : cvar95 < 7 ? 62 : cvar95 < 10 ? 78 : 90;
    parts.push(cvarScore);
    notes.push(`CVaR 95 % ≈ ${cvar95.toFixed(1).replace(".", ",")} %`);
  }

  if (parts.length === 0) {
    return {
      score: null,
      note: "Risque de marché N/D (historique insuffisant pour volatilité / drawdown / VaR).",
      maxDd,
      var95,
      var99,
      cvar95,
    };
  }
  const score = clamp100(parts.reduce((a, b) => a + b, 0) / parts.length);
  return {
    score,
    note: `Marché : ${notes.join(" · ")}.`,
    maxDd,
    var95,
    var99,
    cvar95,
  };
}

function liquidityPillar(
  mktcap: number | undefined,
  closes: RiskClosePoint[] | undefined
): { score: number | null; note: string } {
  const notes: string[] = [];
  const parts: number[] = [];

  if (typeof mktcap === "number" && mktcap > 0) {
    // mktcap en milliards FCFA (convention seed OuestBourse)
    const capScore =
      mktcap >= 500 ? 18 : mktcap >= 150 ? 32 : mktcap >= 50 ? 48 : mktcap >= 15 ? 65 : 82;
    parts.push(capScore);
    notes.push(`cap. ${mktcap.toLocaleString("fr-FR")} Md`);
  }

  const avgVol = closes?.length ? avgVolume(closes) : null;
  if (avgVol != null) {
    const volScore =
      avgVol >= 50_000 ? 22 : avgVol >= 10_000 ? 40 : avgVol >= 2_000 ? 58 : avgVol >= 500 ? 72 : 88;
    parts.push(volScore);
    notes.push(`volume moy. ${Math.round(avgVol).toLocaleString("fr-FR")}`);
  }

  if (parts.length === 0) {
    return {
      score: null,
      note: "Liquidité N/D (capitalisation / volumes non disponibles).",
    };
  }
  return {
    score: clamp100(parts.reduce((a, b) => a + b, 0) / parts.length),
    note: `Liquidité : ${notes.join(" · ")}.`,
  };
}

function fundamentalPillar(
  per: number,
  dividends: Record<number, number>,
  years: number[],
  historyDepth: number
): { score: number | null; note: string } {
  const notes: string[] = [];
  const parts: number[] = [];

  if (per > 0 && per <= 80) {
    // PER très bas ou très haut = risque fondamental (qualité / surévaluation)
    const perScore =
      per < 5 ? 55 : per < 10 ? 28 : per < 18 ? 35 : per < 30 ? 52 : per <= 50 ? 70 : 85;
    parts.push(perScore);
    notes.push(`PER ${per.toFixed(1).replace(".", ",")}`);
  } else if (!(per > 0)) {
    parts.push(55);
    notes.push("PER N/D");
  } else {
    parts.push(80);
    notes.push(`PER extrême (${per.toFixed(0)})`);
  }

  const validDivYears = years.filter((y) => (dividends[y] ?? 0) > 0).length;
  const window = Math.max(1, Math.min(12, historyDepth || years.length || 1));
  const regularity = validDivYears / window;
  const divScore = regularity >= 0.8 ? 22 : regularity >= 0.5 ? 40 : regularity >= 0.25 ? 58 : 78;
  parts.push(divScore);
  notes.push(`dividendes ${validDivYears}/${window} ans`);

  if (historyDepth > 0 && historyDepth < 3) {
    parts.push(70);
    notes.push("historique court");
  } else if (historyDepth >= 8) {
    parts.push(28);
  }

  return {
    score: clamp100(parts.reduce((a, b) => a + b, 0) / parts.length),
    note: `Fondamental : ${notes.join(" · ")}.`,
  };
}

function operationalPillar(sector: string | undefined): { score: number | null; note: string } {
  if (!sector || !sector.trim()) {
    return { score: null, note: "Risque opérationnel N/D (secteur non renseigné)." };
  }
  const known = SECTOR_OP_RISK[sector];
  if (known != null) {
    return {
      score: clamp100(known),
      note: `Opérationnel : cyclicity proxy secteur « ${sector} ».`,
    };
  }
  // Neutre si secteur inconnu du mapping
  return {
    score: 50,
    note: `Opérationnel : secteur « ${sector} » sans profil cyclique dédié (neutre).`,
  };
}

/**
 * Score de risque composite pondéré.
 * Les piliers N/D sont exclus et leurs poids redistribués sur les piliers évalués.
 */
export function computeRiskAnalysis(input: RiskAnalysisInput): RiskAnalysis {
  const historyDepth =
    input.historyDepth ??
    input.years.filter((y) => (input.prices[y] ?? 0) > 0).length;

  const marche = marketPillar(input.volatilityPercent, input.closes);
  const liquidite = liquidityPillar(input.mktcap, input.closes);
  const fondamental = fundamentalPillar(input.per, input.dividends, input.years, historyDepth);
  const operationnel = operationalPillar(input.sector);

  const raw: Array<Omit<RiskPillar, "weight"> & { baseWeight: number }> = [
    {
      key: "marche",
      label: "Risque de marché",
      score: marche.score,
      baseWeight: WEIGHTS.marche,
      note: marche.note,
    },
    {
      key: "liquidite",
      label: "Risque de liquidité",
      score: liquidite.score,
      baseWeight: WEIGHTS.liquidite,
      note: liquidite.note,
    },
    {
      key: "fondamental",
      label: "Risque fondamental",
      score: fondamental.score,
      baseWeight: WEIGHTS.fondamental,
      note: fondamental.note,
    },
    {
      key: "operationnel",
      label: "Risque opérationnel",
      score: operationnel.score,
      baseWeight: WEIGHTS.operationnel,
      note: operationnel.note,
    },
  ];

  const evaluated = raw.filter((p) => p.score != null);
  const totalW = evaluated.reduce((a, p) => a + p.baseWeight, 0) || 1;

  const pillars: RiskPillar[] = raw.map((p) => ({
    key: p.key,
    label: p.label,
    score: p.score,
    weight: p.score != null ? Math.round((p.baseWeight / totalW) * 1000) / 1000 : 0,
    note: p.note,
  }));

  let riskScore = 50;
  if (evaluated.length > 0) {
    riskScore = clamp100(
      evaluated.reduce((a, p) => a + (p.score as number) * (p.baseWeight / totalW), 0)
    );
  }

  const riskTier = riskTierFromScore(riskScore);
  const scoredNotes = pillars
    .filter((p) => p.score != null)
    .map((p) => `${p.label.split(" ").pop()} ${p.score}`)
    .slice(0, 3);

  const summary = `Risque ${riskTier.toLowerCase()} (score ${riskScore}/100). ${
    scoredNotes.length ? `Piliers : ${scoredNotes.join(", ")}.` : "Données insuffisantes pour un détail pilier."
  }`;

  return {
    riskScore,
    riskTier,
    pillars,
    summary,
    maxDrawdownPercent: marche.maxDd,
    var95Percent: marche.var95,
    var99Percent: marche.var99,
    cvar95Percent: marche.cvar95,
  };
}
