// Historique Sikafinance pour densifier / croiser les graphes (GetHistos).

import { sikafinanceConnector } from "@/lib/ingestion/connectors/sikafinance_connector";
import { toIsoDate } from "@/lib/ingestion/parse-utils";
import type { ChartClosePoint } from "./indicators";

/** Début de la fenêtre journalière détaillée (zoom graphes 2024+). */
export const SIKA_DETAILED_DAILY_FROM = "2024-01-01";

export type SikafinanceCloseSeriesOptions = {
  /** Ne charger que depuis cette date (séances nouvelles / complément). */
  dailyFromIso?: string;
  /** Inclure l'historique annuel long (lent) — false si déjà couvert en base/cache. */
  includeAnnual?: boolean;
};

function quotesToPoints(
  quotes: Array<{ date: string; closePrice: number; volume: number | null }>
): ChartClosePoint[] {
  const now = toIsoDate(new Date());
  return quotes
    .filter((q) => q.closePrice > 0 && q.date <= now)
    .map((q) => ({
      time: q.date,
      value: Math.round(q.closePrice * 100) / 100,
      volume: q.volume,
    }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Historique journalier chunké (évite `toolong` Sika).
 * Par défaut depuis 2024-01-01 pour densifier le zoom graphes.
 */
export async function fetchSikafinanceDailyCloseSeries(
  ticker: string,
  fromIso: string = SIKA_DETAILED_DAILY_FROM
): Promise<ChartClosePoint[]> {
  const result = await sikafinanceConnector.fetchDailyHistoryChunked(ticker, fromIso);
  if (!result.ok) {
    console.warn(`[charts] Sikafinance daily ${ticker}:`, result.error);
    return [];
  }
  return quotesToPoints(result.data);
}

/** Historique annuel long (xperiod=365) — comble les années manquantes. */
export async function fetchSikafinanceAnnualCloseSeries(
  ticker: string,
  fromYear = 2000
): Promise<ChartClosePoint[]> {
  const result = await sikafinanceConnector.fetchAnnualHistory(ticker, fromYear);
  if (!result.ok) {
    console.warn(`[charts] Sikafinance annual ${ticker}:`, result.error);
    return [];
  }
  return quotesToPoints(result.data);
}

/**
 * Annuel (optionnel) + journalier depuis `dailyFromIso`.
 * Pour un complément tip : `{ dailyFromIso: lastDate-3j, includeAnnual: false }`.
 */
export async function fetchSikafinanceCloseSeries(
  ticker: string,
  options: SikafinanceCloseSeriesOptions = {}
): Promise<ChartClosePoint[]> {
  const dailyFrom = options.dailyFromIso ?? SIKA_DETAILED_DAILY_FROM;
  const includeAnnual = options.includeAnnual !== false;

  const dailyPromise = fetchSikafinanceDailyCloseSeries(ticker, dailyFrom);
  if (!includeAnnual) {
    return dailyPromise;
  }

  const [annual, daily] = await Promise.all([
    fetchSikafinanceAnnualCloseSeries(ticker),
    dailyPromise,
  ]);
  const byDay = new Map<string, ChartClosePoint>();
  for (const p of annual) byDay.set(p.time, p);
  for (const p of daily) byDay.set(p.time, p);
  return [...byDay.values()].sort((a, b) => a.time.localeCompare(b.time));
}
