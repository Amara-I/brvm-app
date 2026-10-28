// Charge utile du graphe NGX — même forme que GET /api/charts/:ticker (BRVM) pour que
// le workbench charge, compare et fenêtre une série NGX sans branche de code dédiée.
// Module pur (sans Prisma) : testé à part ; le chargement est dans lib/markets/ngx-chart.ts.

import { applyChartSeriesWindow, type ChartWindowQuery } from "./chart-window";
import { lookbackDaysForInterval, sliceContiguousLookback } from "./contiguous-lookback";
import type { ChartClosePoint } from "./indicators";
import type { CandleInterval } from "./ohlc-aggregate";
import { splitBetween } from "@/lib/corporate-actions/adjust";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";
import { marketCapBn } from "@/lib/ngx/valuation";

export interface NgxChartPayloadInput {
  kind: "company" | "index";
  symbol: string;
  name: string;
  color: string;
  sector: string;
  /** Clôtures ajustées des opérations (splits) ; volume absent pour un indice. */
  series: ChartClosePoint[];
  actions: AdjustmentAction[];
  /** Source de la dernière séance (libellé brut en base, ex. NGX_OFFICIEL). */
  source: string | null;
  sources: string[];
  /** Titres en circulation (aujourd'hui) — uniquement pour la capitalisation. */
  sharesOutstanding: number | null;
}

export interface NgxChartPayloadQuery extends ChartWindowQuery {
  interval?: string | null;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function stripPoint({ time, value, volume }: ChartClosePoint): ChartClosePoint {
  return { time, value, volume: volume ?? null };
}

/** Plus haut / plus bas des clôtures sur les 365 derniers jours calendaires (null si < 2 points). */
export function fiftyTwoWeekRange(series: ChartClosePoint[]): { high: number | null; low: number | null } {
  const last = series[series.length - 1];
  if (!last) return { high: null, low: null };
  const cutoff = new Date(`${last.time.slice(0, 10)}T00:00:00.000Z`);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const window = series.filter((p) => p.time.slice(0, 10) >= cutoffIso && p.value > 0);
  if (window.length < 2) return { high: null, low: null };
  let high = -Infinity;
  let low = Infinity;
  for (const p of window) {
    if (p.value > high) high = p.value;
    if (p.value < low) low = p.value;
  }
  return { high, low };
}

export function buildNgxChartPayload(input: NgxChartPayloadInput, query: NgxChartPayloadQuery = {}) {
  const { series, actions } = input;
  const windowed = applyChartSeriesWindow(series, query);
  const last = series[series.length - 1] ?? null;
  const prev = series.length >= 2 ? series[series.length - 2]! : null;

  // Série ajustée des splits : la variation de séance se lit sur elle (même base des deux côtés).
  // Si une opération tombe entre les deux dernières séances, la variation n'est pas fiable : N/D.
  const splitAcross = last && prev ? splitBetween(actions, prev.time, last.time) : false;
  const dayChangePercent =
    last && prev && prev.value > 0 && !splitAcross ? round2(((last.value - prev.value) / prev.value) * 100) : null;
  const dayChangeAbs = last && prev && !splitAcross ? round2(last.value - prev.value) : null;

  let change1Y: number | null = null;
  if (last && series.length >= 2) {
    const target = new Date(`${last.time.slice(0, 10)}T00:00:00.000Z`);
    target.setUTCFullYear(target.getUTCFullYear() - 1);
    const targetIso = target.toISOString().slice(0, 10);
    // Pas de variation 1 an si l'historique ne remonte pas jusque-là (N/D plutôt qu'un chiffre trompeur).
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
  const cap = input.kind === "company" ? marketCapBn(last?.value ?? null, input.sharesOutstanding) : null;
  const first = series[0]?.time ?? null;

  return {
    ticker: input.symbol,
    name: input.name,
    color: input.color,
    country: "Nigeria",
    countryFlag: "🇳🇬",
    sector: input.sector,
    series: windowed.series.map(stripPoint),
    lookback: lookback.map(stripPoint),
    // Pas de PER / rendement ici : le workbench NGX affiche ses propres tuiles (capitalisation, 52 sem.).
    fundamentals: { per: null, mktCapMds: null, dividendYieldPercent: null },
    stats: {
      lastClose: last?.value ?? null,
      lastDate: last?.time ?? null,
      firstDate: windowed.series[0]?.time ?? first,
      points: windowed.series.length,
      historyPoints: series.length,
      historyFirstDate: first,
      historyLastDate: last?.time ?? null,
      range: windowed.range,
      from: windowed.from,
      to: windowed.to,
      lookbackExhausted,
      dayChangePercent,
      dayChangeAbs,
      change1YPercent: change1Y,
      lastVolume: last?.volume ?? null,
      source: input.source,
      seriesSources: input.sources,
      seriesEnriched: false,
    },
    corporateActions: actions
      .filter((action) => action.adjustPrices)
      .map((action) => ({ effectiveDate: action.effectiveDate, label: action.label })),
    ngx: {
      kind: input.kind,
      high52: range52.high,
      low52: range52.low,
      mktCapBn: cap,
    },
  };
}

export type NgxChartPayload = ReturnType<typeof buildNgxChartPayload>;
