// Historique annuel des ratios canoniques d'une société.
// Une année peut avoir plusieurs lignes (une par source) : on garde, champ
// par champ, la source prioritaire qui a une valeur. Rien n'est recalculé.

const SOURCE_RANK: Record<string, number> = {
  BRVM_OFFICIEL: 0,
  SIKAFINANCE: 1,
  OUESTBOURSE: 2,
  RICHBOURSE: 3,
  MANUEL: 4,
};

export interface AnnualRatioPoint {
  year: number;
  per: number | null;
  pbRatio: number | null;
  roe: number | null;
  netMargin: number | null;
  debtRatio: number | null;
  revenueGrowth: number | null;
  fcf: number | null;
}

export interface RatioHistoryRow {
  year: number;
  source: string;
  per: number | null;
  pbRatio: number | null;
  roe: number | null;
  netMargin: number | null;
  debtRatio: number | null;
  revenueGrowth: number | null;
  fcf: number | null;
}

function finite(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** 0 = non publié. Un PER négatif est conservé pour être signalé, pas effacé. */
function keepPer(per: number | null): number | null {
  if (!finite(per) || per === 0) return null;
  return per;
}

function keep(n: number | null): number | null {
  return finite(n) ? n : null;
}

const EMPTY = (): Omit<AnnualRatioPoint, "year"> => ({
  per: null,
  pbRatio: null,
  roe: null,
  netMargin: null,
  debtRatio: null,
  revenueGrowth: null,
  fcf: null,
});

/**
 * Une ligne par exercice, champs remplis par la source la plus prioritaire
 * qui publie le champ. L'ordre d'entrée ne compte pas.
 */
export function collapseCanonicalRatios(rows: readonly RatioHistoryRow[]): AnnualRatioPoint[] {
  const byYear = new Map<number, Omit<AnnualRatioPoint, "year">>();
  const ranked = [...rows]
    .filter((row) => Number.isInteger(row.year))
    .sort((a, b) => a.year - b.year || (SOURCE_RANK[a.source] ?? 9) - (SOURCE_RANK[b.source] ?? 9));

  for (const row of ranked) {
    const slot = byYear.get(row.year) ?? EMPTY();
    const per = keepPer(row.per);
    if (slot.per == null && per != null) slot.per = per;
    if (slot.pbRatio == null && keep(row.pbRatio) != null) slot.pbRatio = keep(row.pbRatio);
    if (slot.roe == null && keep(row.roe) != null) slot.roe = keep(row.roe);
    if (slot.netMargin == null && keep(row.netMargin) != null) slot.netMargin = keep(row.netMargin);
    if (slot.debtRatio == null && keep(row.debtRatio) != null) slot.debtRatio = keep(row.debtRatio);
    if (slot.revenueGrowth == null && keep(row.revenueGrowth) != null) slot.revenueGrowth = keep(row.revenueGrowth);
    if (slot.fcf == null && keep(row.fcf) != null) slot.fcf = keep(row.fcf);
    byYear.set(row.year, slot);
  }

  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, fields]) => ({ year, ...fields }));
}
