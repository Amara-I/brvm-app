// Fusion du compte de résultat annuel (fiche société) quand plusieurs lignes
// canoniques coexistent pour une même année (ex. SIKAFINANCE + MANUEL).
// Règle : champ par champ, la source la plus prioritaire (SOURCE_PRIORITY)
// fournit la valeur ; une source moins prioritaire ne comble que les trous.
// Sans cette fusion, la dernière ligne lue écrasait les précédentes et pouvait
// remplacer un chiffre d'affaires renseigné par `null`.

import { sourceRank } from "@/lib/ingestion/reconciliation";
import type { DataSourceCode } from "@/lib/ingestion/types";

export interface IncomeRowInput {
  year: number;
  source: string | null | undefined;
  revenue: unknown;
  netIncome: unknown;
  operatingIncome: unknown;
}

export interface MergedIncomePoint {
  year: number;
  revenue: number | null;
  netIncome: number | null;
  operatingIncome: number | null;
}

function finite(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rankOf(source: string | null | undefined): number {
  return sourceRank((source ?? "") as DataSourceCode);
}

/** Fusionne les lignes par année, champ par champ, par ordre de priorité des sources. Résultat trié par année. */
export function mergeIncomeRowsBySource(rows: IncomeRowInput[]): MergedIncomePoint[] {
  const sorted = [...rows].sort((a, b) => a.year - b.year || rankOf(a.source) - rankOf(b.source));
  const byYear = new Map<number, MergedIncomePoint>();
  for (const r of sorted) {
    const year = Number(r.year);
    if (!Number.isInteger(year)) continue;
    const cur = byYear.get(year) ?? { year, revenue: null, netIncome: null, operatingIncome: null };
    cur.revenue ??= finite(r.revenue);
    cur.netIncome ??= finite(r.netIncome);
    cur.operatingIncome ??= finite(r.operatingIncome);
    byYear.set(year, cur);
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}
