// Série du graphe de la carte marché (landing) — fonctions pures, sans React.
// Principe : uniquement des points réels de l'indice, jamais interpolés ni
// lissés. Le sous-échantillonnage garde de vrais points (min/max par tranche)
// pour ne cacher aucun sommet ni creux.

export interface HeroPoint {
  /** Date ISO yyyy-mm-dd. */
  time: string;
  value: number;
}

export type HeroRange = "1Y" | "3Y" | "5Y" | "MAX";

export const HERO_RANGE_YEARS: Record<Exclude<HeroRange, "MAX">, number> = { "1Y": 1, "3Y": 3, "5Y": 5 };

/** Tolérance (jours) : une série qui démarre à ≤ 14 j de la borne couvre la période. */
const COVERAGE_TOLERANCE_DAYS = 14;

function shiftYearsIso(iso: string, years: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function dayDiff(aIso: string, bIso: string): number {
  return Math.round((Date.parse(`${bIso}T00:00:00.000Z`) - Date.parse(`${aIso}T00:00:00.000Z`)) / 86_400_000);
}

/** Nettoie : valeurs finies > 0, dates uniques, ordre chronologique. */
export function cleanHeroSeries(points: ReadonlyArray<HeroPoint>): HeroPoint[] {
  const byDay = new Map<string, number>();
  for (const p of points) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.time)) continue;
    if (!Number.isFinite(p.value) || !(p.value > 0)) continue;
    byDay.set(p.time, p.value);
  }
  return [...byDay.entries()]
    .map(([time, value]) => ({ time, value }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** Périodes réellement couvertes par la série (1A/3A/5A) — jamais promises à tort. */
export function availableHeroRanges(series: ReadonlyArray<HeroPoint>): HeroRange[] {
  if (series.length < 2) return [];
  const first = series[0]!.time;
  const last = series[series.length - 1]!.time;
  const out: HeroRange[] = [];
  for (const key of ["1Y", "3Y", "5Y"] as const) {
    const cutoff = shiftYearsIso(last, HERO_RANGE_YEARS[key]);
    if (dayDiff(first, cutoff) >= -COVERAGE_TOLERANCE_DAYS) out.push(key);
  }
  if (out.length === 0) out.push("MAX");
  return out;
}

/**
 * Fenêtre [dernier point − N ans, dernier point]. Le point de départ est le
 * dernier point connu à la date-borne ou avant (comme `computeIndexStats`),
 * sinon le premier point de la série.
 */
export function sliceHeroRange(series: ReadonlyArray<HeroPoint>, range: HeroRange): HeroPoint[] {
  if (series.length === 0) return [];
  if (range === "MAX") return [...series];
  const last = series[series.length - 1]!.time;
  const cutoff = shiftYearsIso(last, HERO_RANGE_YEARS[range]);
  let startIdx = 0;
  for (let i = 0; i < series.length; i++) {
    if (series[i]!.time <= cutoff) startIdx = i;
    else break;
  }
  return series.slice(startIdx);
}

/** Variation en % entre le premier et le dernier point (null si indéfinie). */
export function heroChangePercent(series: ReadonlyArray<HeroPoint>): number | null {
  if (series.length < 2) return null;
  const from = series[0]!.value;
  const to = series[series.length - 1]!.value;
  if (!(from > 0)) return null;
  return ((to - from) / from) * 100;
}

/**
 * Réduit à ≈ `maxPoints` vrais points : par tranche on garde le min et le max
 * (dans l'ordre chronologique), et toujours le premier et le dernier point.
 */
export function downsampleHeroSeries(series: ReadonlyArray<HeroPoint>, maxPoints: number): HeroPoint[] {
  if (series.length <= maxPoints || maxPoints < 4) return [...series];
  const interior = series.slice(1, -1);
  const buckets = Math.max(1, Math.floor((maxPoints - 2) / 2));
  const size = interior.length / buckets;
  const keep = new Set<number>([0, series.length - 1]);
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * size);
    const to = Math.min(interior.length, Math.floor((b + 1) * size));
    if (to <= from) continue;
    let minI = from;
    let maxI = from;
    for (let i = from; i < to; i++) {
      if (interior[i]!.value < interior[minI]!.value) minI = i;
      if (interior[i]!.value > interior[maxI]!.value) maxI = i;
    }
    keep.add(minI + 1);
    keep.add(maxI + 1);
  }
  return [...keep].sort((a, b) => a - b).map((i) => series[i]!);
}

export interface HeroGeometry {
  linePath: string;
  areaPath: string;
  /** Domaine de l'axe Y (bornes réelles du graphe, marge comprise). */
  yMin: number;
  yMax: number;
  /** Plus bas / plus haut réels de la période. */
  dataMin: number;
  dataMax: number;
  /** Position en % (0–100) de chaque point, pour l'infobulle. */
  xPct: number[];
  yPct: number[];
  /** Position verticale (%) des extrêmes réels de la période. */
  yPctOfMax: number;
  yPctOfMin: number;
}

/**
 * Géométrie SVG linéaire (aucun lissage : segments droits). Axe Y non nul —
 * c'est un indice, pas un volume — borné au min/max de la période + 8 % de
 * marge, afin que l'amplitude visible reflète l'amplitude réelle.
 */
export function buildHeroGeometry(
  series: ReadonlyArray<HeroPoint>,
  width: number,
  height: number,
  padTop = 10,
  padBottom = 6
): HeroGeometry | null {
  if (series.length < 2) return null;
  const values = series.map((p) => p.value);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const rawSpan = dataMax - dataMin || Math.max(Math.abs(dataMax) * 0.02, 1);
  const yMin = dataMin - rawSpan * 0.08;
  const yMax = dataMax + rawSpan * 0.08;
  const span = yMax - yMin;
  const t0 = Date.parse(`${series[0]!.time}T00:00:00.000Z`);
  const t1 = Date.parse(`${series[series.length - 1]!.time}T00:00:00.000Z`);
  const tSpan = t1 - t0 || 1;
  const usableH = height - padTop - padBottom;

  const xs = series.map((p) => ((Date.parse(`${p.time}T00:00:00.000Z`) - t0) / tSpan) * width);
  const ys = series.map((p) => padTop + usableH - ((p.value - yMin) / span) * usableH);
  const yOf = (v: number) => padTop + usableH - ((v - yMin) / span) * usableH;
  const f = (n: number) => n.toFixed(1);
  const linePath = xs.map((x, i) => `${i === 0 ? "M" : "L"}${f(x)} ${f(ys[i]!)}`).join(" ");
  const areaPath = `${linePath} L${f(xs[xs.length - 1]!)} ${f(height)} L${f(xs[0]!)} ${f(height)} Z`;
  return {
    linePath,
    areaPath,
    yMin,
    yMax,
    dataMin,
    dataMax,
    xPct: xs.map((x) => (x / width) * 100),
    yPct: ys.map((y) => (y / height) * 100),
    yPctOfMax: (yOf(dataMax) / height) * 100,
    yPctOfMin: (yOf(dataMin) / height) * 100,
  };
}

/** Index du point le plus proche d'une position horizontale (0–1). */
export function nearestHeroIndex(xPct: ReadonlyArray<number>, ratio: number): number {
  const target = Math.min(1, Math.max(0, ratio)) * 100;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < xPct.length; i++) {
    const dist = Math.abs(xPct[i]! - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}
