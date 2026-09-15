// ═══════════════════════════════════════════════════════════════════════════
// Réconciliation multi-source — logique pure, sans I/O, entièrement testable
// ═══════════════════════════════════════════════════════════════════════════
// Implémente la règle décrite dans AGENTS.md : en cas de divergence entre
// sources pour un même ticker/date, on retient BRVM.org (officiel) en
// premier, puis Sikafinance, puis Richbourse. Tout écart > SEUIL_ECART_PERCENT
// entre au moins deux sources est reporté pour être journalisé dans
// `data_discrepancies` (étape 6) — cette fonction ne touche PAS la base, elle
// se contente de calculer le résultat ; c'est à l'appelant (script cron) de
// persister via Prisma.

import type { DataSourceCode, RawIndexQuote, RawPriceQuote } from "./types";

/// Ordre de priorité — index le plus bas = priorité la plus haute.
export const SOURCE_PRIORITY: DataSourceCode[] = [
  "BRVM_OFFICIEL",
  "SIKAFINANCE",
  "OUESTBOURSE",
  "RICHBOURSE",
  "MANUEL",
];

/// Seuil d'écart relatif (%) au-delà duquel une divergence entre deux
/// sources doit être journalisée pour audit manuel (cf. brief).
export const DISCREPANCY_THRESHOLD_PERCENT = 2;

export function sourceRank(source: DataSourceCode): number {
  const idx = SOURCE_PRIORITY.indexOf(source);
  return idx === -1 ? SOURCE_PRIORITY.length : idx;
}

/** `true` si `a` est strictement prioritaire sur `b` (rang plus petit). */
export function sourceOutranks(a: DataSourceCode, b: DataSourceCode): boolean {
  return sourceRank(a) < sourceRank(b);
}

/** Sources strictement plus prioritaires que `source` (pour bloquer un canonique). */
export function sourcesOutranking(source: DataSourceCode): DataSourceCode[] {
  return SOURCE_PRIORITY.filter((s) => sourceOutranks(s, source));
}

export interface DiscrepancyReport {
  ticker: string;
  date: string;
  field: "close_price" | "close_price_collar";
  brvmValue: number | null;
  sikaValue: number | null;
  richValue: number | null;
  deltaPercent: number;
}

export interface ReconciledPrice {
  ticker: string;
  date: string;
  closePrice: number;
  /// Source retenue comme valeur canonique, selon l'ordre de priorité.
  resolvedSource: DataSourceCode;
  /// Toutes les valeurs brutes disponibles, pour traçabilité.
  candidates: RawPriceQuote[];
}

function maxDeltaPercent(values: number[]): number {
  if (values.length < 2) return 0;
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (min === 0) return max === 0 ? 0 : 100;
  return Math.abs((max - min) / min) * 100;
}

/// Réconcilie les cours de clôture d'UN ticker/UNE date collectés depuis
/// plusieurs sources. Retourne la valeur canonique (priorité la plus haute
/// disponible) et, le cas échéant, un rapport d'écart si les sources
/// divergent de plus de `DISCREPANCY_THRESHOLD_PERCENT`.
export function reconcilePriceQuotes(
  ticker: string,
  date: string,
  quotesFromAllSources: RawPriceQuote[]
): { reconciled: ReconciledPrice | null; discrepancy: DiscrepancyReport | null } {
  const relevant = quotesFromAllSources.filter((q) => q.ticker === ticker && q.date === date);
  if (relevant.length === 0) {
    return { reconciled: null, discrepancy: null };
  }

  const sorted = [...relevant].sort((a, b) => sourceRank(a.source) - sourceRank(b.source));
  const winner = sorted[0];

  const byBrvm = relevant.find((q) => q.source === "BRVM_OFFICIEL")?.closePrice ?? null;
  const bySika = relevant.find((q) => q.source === "SIKAFINANCE")?.closePrice ?? null;
  const byRich = relevant.find((q) => q.source === "RICHBOURSE")?.closePrice ?? null;

  const values = [byBrvm, bySika, byRich].filter((v): v is number => v !== null);
  const delta = maxDeltaPercent(values);

  const discrepancy: DiscrepancyReport | null =
    delta > DISCREPANCY_THRESHOLD_PERCENT
      ? {
          ticker,
          date,
          field: "close_price",
          brvmValue: byBrvm,
          sikaValue: bySika,
          richValue: byRich,
          deltaPercent: Math.round(delta * 100) / 100,
        }
      : null;

  return {
    reconciled: {
      ticker,
      date,
      closePrice: winner.closePrice,
      resolvedSource: winner.source,
      candidates: relevant,
    },
    discrepancy,
  };
}

/// Réconcilie un lot de cotations (plusieurs tickers, éventuellement
/// plusieurs dates) collectées depuis toutes les sources en une seule passe.
export function reconcilePriceBatch(allQuotes: RawPriceQuote[]): {
  reconciled: ReconciledPrice[];
  discrepancies: DiscrepancyReport[];
} {
  const keys = new Set(allQuotes.map((q) => `${q.ticker}__${q.date}`));
  const reconciled: ReconciledPrice[] = [];
  const discrepancies: DiscrepancyReport[] = [];

  for (const key of keys) {
    const [ticker, date] = key.split("__");
    const { reconciled: r, discrepancy } = reconcilePriceQuotes(ticker, date, allQuotes);
    if (r) reconciled.push(r);
    if (discrepancy) discrepancies.push(discrepancy);
  }

  return { reconciled, discrepancies };
}

export interface ReconciledIndex {
  code: string;
  date: string;
  value: number;
  changePercent: number | null;
  resolvedSource: DataSourceCode;
  candidates: RawIndexQuote[];
}

/// Même logique de priorité que `reconcilePriceQuotes`, appliquée aux
/// indices de marché (BRVM Composite, BRVM 30...).
export function reconcileIndexQuotes(
  code: string,
  date: string,
  quotesFromAllSources: RawIndexQuote[]
): { reconciled: ReconciledIndex | null; deltaPercent: number } {
  const relevant = quotesFromAllSources.filter((q) => q.code === code && q.date === date);
  if (relevant.length === 0) return { reconciled: null, deltaPercent: 0 };

  const sorted = [...relevant].sort((a, b) => sourceRank(a.source) - sourceRank(b.source));
  const winner = sorted[0];
  const delta = maxDeltaPercent(relevant.map((q) => q.value));

  return {
    reconciled: {
      code,
      date,
      value: winner.value,
      changePercent: winner.changePercent,
      resolvedSource: winner.source,
      candidates: relevant,
    },
    deltaPercent: Math.round(delta * 100) / 100,
  };
}

export function reconcileIndexBatch(allQuotes: RawIndexQuote[]): ReconciledIndex[] {
  const keys = new Set(allQuotes.map((q) => `${q.code}__${q.date}`));
  const reconciled: ReconciledIndex[] = [];
  for (const key of keys) {
    const [code, date] = key.split("__");
    if (!code || !date) continue;
    const { reconciled: row } = reconcileIndexQuotes(code, date, allQuotes);
    if (row) reconciled.push(row);
  }
  return reconciled;
}

/** Ne pas élever une source s'il existe déjà une valeur plus prioritaire. */
export function canElevateCanonical(
  resolvedSource: DataSourceCode,
  existingSources: Iterable<DataSourceCode>
): boolean {
  for (const source of existingSources) {
    if (sourceOutranks(source, resolvedSource)) return false;
  }
  return true;
}
