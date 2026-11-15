// Aligne le dernier point d'une série (cache `chart_series`, aperçu) sur le dernier
// cours canonique : nouvelle séance → point ajouté ; même séance mais cours corrigé
// (ex. cours intrajournalier remplacé par la clôture officielle) → point remplacé.
// Sans ce remplacement, une série construite avec un cours provisoire gardait
// l'ancien prix jusqu'à la reconstruction du cache le lendemain.

import type { ChartClosePoint } from "./indicators";

export interface LatestClosePoint {
  /** `YYYY-MM-DD` */
  date: string;
  /** Même base que la série (fractionnements déjà appliqués). */
  close: number;
}

/** Vrai si la série ne reflète pas `latest` (séance manquante ou cours différent le même jour). */
export function seriesBehindLatest(series: readonly ChartClosePoint[], latest: LatestClosePoint | null | undefined): boolean {
  if (!latest || !(latest.close > 0)) return false;
  const last = series[series.length - 1];
  if (!last) return true;
  const lastDay = last.time.slice(0, 10);
  if (lastDay < latest.date) return true;
  if (lastDay === latest.date) return Math.abs(last.value - latest.close) > 1e-6;
  return false;
}

export function overlayLatestClose(
  series: readonly ChartClosePoint[],
  latest: LatestClosePoint | null | undefined
): ChartClosePoint[] {
  if (!latest || !(latest.close > 0) || !seriesBehindLatest(series, latest)) return [...series];
  const last = series[series.length - 1];
  if (last && last.time.slice(0, 10) === latest.date) {
    return [...series.slice(0, -1), { ...last, value: latest.close }];
  }
  return [...series, { time: latest.date, value: latest.close, volume: null }];
}

/** Superpose plusieurs derniers cours (par ticker) sur un jeu de séries. */
export function overlayLatestCloses(
  byTicker: Record<string, ChartClosePoint[]>,
  latest: ReadonlyMap<string, LatestClosePoint>
): Record<string, ChartClosePoint[]> {
  const out: Record<string, ChartClosePoint[]> = {};
  for (const [ticker, series] of Object.entries(byTicker)) {
    const quote = latest.get(ticker);
    out[ticker] = quote ? overlayLatestClose(series, quote) : series;
  }
  return out;
}
