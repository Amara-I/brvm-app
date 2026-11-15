// Charge utile d'un graphe d'indice (BRVM ou NGX) pour le workbench /graphes.
// Même forme que GET /api/charts/:ticker, sans signaux ni fondamentaux de société.
// Module pur (sans Prisma) : la série déjà sous-échantillonnée vient de loadIndexSheetBundle.

import { applyChartSeriesWindow, type ChartWindowQuery } from "./chart-window";
import { lookbackDaysForInterval, sliceContiguousLookback } from "./contiguous-lookback";
import type { ChartClosePoint } from "./indicators";
import type { CandleInterval } from "./ohlc-aggregate";
import { fiftyTwoWeekRange } from "./ngx-chart-payload";
import { INDEX_COLOR } from "./chart-catalog-core";

export interface IndexChartPayloadInput {
  code: string;
  name: string;
  exchange: "BRVM" | "NGX";
  color?: string;
  /** Série composée déjà sous-échantillonnée (quotidien récent, puis hebdo / mensuel). */
  series: Array<{ time: string; value: number }>;
  source: string | null;
  /** Nombre de séances distinctes en base (métadonnée, pas le nombre de points envoyés). */
  storedHistoryPoints?: number | null;
  firstDate?: string | null;
  lastChangePercent?: number | null;
}

export interface IndexChartPayloadQuery extends ChartWindowQuery {
  interval?: string | null;
}

const NGX_FLAG = "🇳🇬";

function toPoint(row: { time: string; value: number }): ChartClosePoint {
  return { time: row.time, value: row.value, volume: null };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function buildIndexChartPayload(input: IndexChartPayloadInput, query: IndexChartPayloadQuery = {}) {
  const series = input.series
    .filter((p) => Number.isFinite(p.value) && p.value > 0)
    .map(toPoint);
  const windowed = applyChartSeriesWindow(series, query);
  const last = series[series.length - 1] ?? null;
  const prev = series.length >= 2 ? series[series.length - 2]! : null;
  const dayChangePercent =
    last && prev && prev.value > 0 ? round2(((last.value - prev.value) / prev.value) * 100) : null;
  const dayChangeAbs = last && prev ? round2(last.value - prev.value) : null;

  let change1Y: number | null = null;
  if (last && series.length >= 2) {
    const target = new Date(`${last.time.slice(0, 10)}T00:00:00.000Z`);
    target.setUTCFullYear(target.getUTCFullYear() - 1);
    const targetIso = target.toISOString().slice(0, 10);
    if (series[0]!.time.slice(0, 10) <= targetIso) {
      let ref = series[0]!;
      for (const p of series) {
        if (p.time.slice(0, 10) <= targetIso) ref = p;
        else break;
      }
      if (ref.value > 0) change1Y = round2(((last.value - ref.value) / ref.value) * 100);
    }
  }

  const windowStart = windowed.series[0]?.time;
  const intervalHint = (query.interval ?? "1D") as CandleInterval;
  let lookback: ChartClosePoint[] = [];
  let lookbackExhausted = windowed.range === "MAX";
  if (windowStart && windowed.range !== "MAX") {
    const sliced = sliceContiguousLookback(series, windowStart, {
      maxDays: lookbackDaysForInterval(intervalHint),
      maxPoints: 800,
    });
    lookback = sliced.points;
    lookbackExhausted = sliced.exhausted;
  }

  const range52 = fiftyTwoWeekRange(series);
  const first = input.firstDate ?? series[0]?.time ?? null;
  const isNgx = input.exchange === "NGX";

  return {
    ticker: input.code,
    name: input.name,
    color: input.color ?? INDEX_COLOR,
    country: isNgx ? "Nigeria" : "",
    countryFlag: isNgx ? NGX_FLAG : "",
    sector: input.exchange,
    series: windowed.series,
    lookback,
    fundamentals: { per: null, mktCapMds: null, dividendYieldPercent: null },
    stats: {
      lastClose: last?.value ?? null,
      lastDate: last?.time ?? null,
      firstDate: windowed.series[0]?.time ?? first,
      points: windowed.series.length,
      // Le workbench doit considérer cette série composée comme l'historique complet
      // (pas de second aller-retour MAX) : on publie le nombre de points envoyés.
      historyPoints: series.length,
      historyFirstDate: first,
      historyLastDate: last?.time ?? null,
      range: windowed.range,
      from: windowed.from,
      to: windowed.to,
      lookbackExhausted,
      dayChangePercent: input.lastChangePercent ?? dayChangePercent,
      dayChangeAbs,
      change1YPercent: change1Y,
      lastVolume: null,
      source: input.source,
      seriesSources: input.source ? [input.source] : [],
      seriesEnriched: false,
    },
    corporateActions: [] as Array<{ effectiveDate: string; label: string }>,
    index: {
      exchange: input.exchange,
      high52: range52.high,
      low52: range52.low,
      storedHistoryPoints: input.storedHistoryPoints ?? null,
    },
    ngx: isNgx
      ? {
          kind: "index" as const,
          high52: range52.high,
          low52: range52.low,
          mktCapBn: null,
        }
      : undefined,
  };
}

export type IndexChartPayload = ReturnType<typeof buildIndexChartPayload>;
