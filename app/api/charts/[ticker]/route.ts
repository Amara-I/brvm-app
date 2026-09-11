// GET /api/charts/[ticker] — série + fondamentaux pour le workbench TV-like.
// Densification multi-source : base canonique (priorité BRVM à l'ingestion)
// + Sikafinance + Richbourse, croisés avec seuil d'écart 2 %.
//
// Fenêtre : `?range=1A|1Y|5A|MAX|…` (défaut 1A) et/ou `?from=&to=` (YYYY-MM-DD).
// Les métriques / stats de cours restent calculées sur l'historique COMPLET.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiNotFound, apiValidationError, cacheHeaders } from "@/lib/api/response";
import { chartSeriesQuerySchema } from "@/lib/api/query-schemas";
import { applyChartSeriesWindow } from "@/lib/charts/chart-window";
import {
  lookbackDaysForInterval,
  sliceContiguousLookback,
} from "@/lib/charts/contiguous-lookback";
import type { CandleInterval } from "@/lib/charts/ohlc-aggregate";
import { calcMetrics } from "@/lib/calc/calc-metrics";
import {
  fetchRichbourseCloseSeries,
  seriesNeedsDensification,
} from "@/lib/charts/fetch-richbourse-series";
import { fetchSikafinanceCloseSeries } from "@/lib/charts/fetch-sikafinance-series";
import {
  fetchOuestboursePriceHistory,
  isOuestbourseSupabaseConfigured,
  obBarsToChartPoints,
} from "@/lib/ingestion/connectors/ouestbourse_supabase";
import { reconcileChartSeries } from "@/lib/charts/reconcile-chart-series";
import { stripIsolatedPriceSpikes } from "@/lib/charts/strip-isolated-spikes";
import { dedupeChartPointsByDay, type ChartClosePoint } from "@/lib/charts/indicators";
import { DISCREPANCY_THRESHOLD_PERCENT } from "@/lib/ingestion/reconciliation";
import {
  chartDbFingerprint,
  getCachedDensifiedSeries,
  getAnyCachedDensifiedSeries,
  setCachedDensifiedSeries,
  shouldSkipLiveDensify,
  withTimeout,
  CHART_DENSIFY_TIMEOUT_MS,
} from "@/lib/charts/chart-densify-cache";
import {
  mergeChartPointsPrefer,
  planChartDensify,
} from "@/lib/charts/chart-densify-strategy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const parsedQuery = chartSeriesQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsedQuery.success) return apiValidationError(parsedQuery.error);
  const windowQuery = parsedQuery.data;

  const company = await prisma.company.findUnique({
    where: { ticker },
    include: { country: true, sector: true },
  });
  if (!company) return apiNotFound(`Société "${ticker}"`);

  const [prices, ratio] = await Promise.all([
    prisma.priceHistory.findMany({
      where: { companyId: company.id, isCanonical: true },
      orderBy: { date: "asc" },
      select: { date: true, closePrice: true, volume: true, source: true },
    }),
    prisma.financialRatio.findFirst({
      where: { companyId: company.id, isCanonical: true },
      orderBy: { year: "desc" },
      select: { per: true, mktCap: true, year: true },
    }),
  ]);

  const dividends = await prisma.dividend.findMany({
    where: { companyId: company.id, isCanonical: true },
    select: { year: true, amount: true },
  });

  const now = Date.now();
  // Plusieurs lignes canoniques peuvent partager le même jour calendaire
  // (timestamps UTC différents) — on garde la dernière du jour.
  const dbByDay = new Map<
    string,
    { time: string; value: number; volume: number | null; source: (typeof prices)[number]["source"] }
  >();
  for (const p of prices) {
    if (p.date.getTime() > now) continue;
    const time = p.date.toISOString().slice(0, 10);
    dbByDay.set(time, {
      time,
      value: Number(p.closePrice),
      volume: p.volume !== null ? Number(p.volume) : null,
      source: p.source,
    });
  }
  const dbSeries = [...dbByDay.values()].sort((a, b) => a.time.localeCompare(b.time));

  let series: ChartClosePoint[] = dbSeries.map(({ time, value, volume }) => ({
    time,
    value,
    volume,
  }));
  let seriesSourceNote: "db" | "multi_source_merged" = "db";
  let discrepanciesCount = 0;
  let densifySources: string[] = [];

  if (!shouldSkipLiveDensify()) {
    const fingerprint = chartDbFingerprint(series);
    const exactCache = getCachedDensifiedSeries(ticker, fingerprint);
    const softCache = exactCache ?? getAnyCachedDensifiedSeries(ticker);

    // Réutiliser l'historique densifié déjà chargé ; n'ajouter que le neuf.
    if (softCache && softCache.series.length >= series.length) {
      series = mergeChartPointsPrefer(
        series.map((p) => ({ time: p.time, value: p.value, volume: p.volume })),
        softCache.series
      );
      seriesSourceNote = "multi_source_merged";
      discrepanciesCount = softCache.discrepanciesCount;
      densifySources = softCache.densifySources;
    }

    const plan = planChartDensify(dbSeries, softCache?.series.length ?? 0);

    if (plan.mode === "tip") {
      try {
        const tip = await fetchSikafinanceCloseSeries(ticker, {
          dailyFromIso: plan.dailyFrom,
          includeAnnual: false,
        });
        if (tip.length > 0) {
          series = mergeChartPointsPrefer(
            series.map((p) => ({ time: p.time, value: p.value, volume: p.volume })),
            tip
          );
          seriesSourceNote = "multi_source_merged";
          if (!densifySources.includes("SIKAFINANCE")) densifySources = [...densifySources, "SIKAFINANCE"];
        }
        setCachedDensifiedSeries(ticker, chartDbFingerprint(dbSeries), series, discrepanciesCount, densifySources);
      } catch (err) {
        console.warn(
          `[charts] ${ticker} tip:`,
          err instanceof Error ? err.message : err
        );
      }
    } else if (plan.mode === "fill") {
      if (exactCache) {
        series = exactCache.series;
        seriesSourceNote = "multi_source_merged";
        discrepanciesCount = exactCache.discrepanciesCount;
        densifySources = exactCache.densifySources;
      } else {
        const densifyPromise = Promise.all([
          fetchSikafinanceCloseSeries(ticker, {
            dailyFromIso: plan.dailyFrom,
            includeAnnual: plan.fetchAnnual,
          }),
          plan.fetchRich ? fetchRichbourseCloseSeries(ticker) : Promise.resolve([]),
          plan.fetchOuestbourse && isOuestbourseSupabaseConfigured()
            ? fetchOuestboursePriceHistory(ticker)
                .then(obBarsToChartPoints)
                .catch((err) => {
                  console.warn(
                    `[charts] OuestBourse ${ticker}:`,
                    err instanceof Error ? err.message : err
                  );
                  return [] as ReturnType<typeof obBarsToChartPoints>;
                })
            : Promise.resolve([] as ReturnType<typeof obBarsToChartPoints>),
        ]).then(([sika, rich, ob]) =>
          reconcileChartSeries({
            canonical: dbSeries.map(({ time, value, volume }) => ({ time, value, volume })),
            sikafinance: sika,
            ouestbourse: ob,
            richbourse: rich,
            thresholdPercent: DISCREPANCY_THRESHOLD_PERCENT,
          })
        );

        const raced = await withTimeout(densifyPromise, CHART_DENSIFY_TIMEOUT_MS);
        if (!raced.ok) {
          console.warn(
            `[charts] ${ticker}: densification abandonnée après ${CHART_DENSIFY_TIMEOUT_MS}ms — série DB servie`
          );
          void densifyPromise
            .then((reconciled) => {
              if (
                reconciled.series.length > dbSeries.length ||
                (seriesNeedsDensification(dbSeries) &&
                  !seriesNeedsDensification(reconciled.series))
              ) {
                const densified = stripIsolatedPriceSpikes(
                  reconciled.series.map((p) => ({
                    time: p.time,
                    value: p.value,
                    volume: p.volume ?? null,
                  }))
                );
                setCachedDensifiedSeries(
                  ticker,
                  fingerprint,
                  densified,
                  reconciled.discrepancies.length,
                  reconciled.sourcesUsed.filter((s) => s !== "DB_CANONICAL")
                );
              }
            })
            .catch(() => undefined);
        } else {
          const reconciled = raced.value;
          if (
            reconciled.series.length > series.length ||
            (seriesNeedsDensification(dbSeries) && !seriesNeedsDensification(reconciled.series))
          ) {
            series = stripIsolatedPriceSpikes(
              reconciled.series.map((p) => ({
                time: p.time,
                value: p.value,
                volume: p.volume ?? null,
              }))
            ).map((p) => ({
              time: p.time,
              value: p.value,
              volume: p.volume ?? null,
            }));
            seriesSourceNote = "multi_source_merged";
            discrepanciesCount = reconciled.discrepancies.length;
            densifySources = reconciled.sourcesUsed.filter((s) => s !== "DB_CANONICAL");
            setCachedDensifiedSeries(
              ticker,
              fingerprint,
              series,
              discrepanciesCount,
              densifySources
            );
            if (reconciled.discrepancies.length > 0) {
              console.warn(
                `[charts] ${ticker}: ${reconciled.discrepancies.length} écart(s) > ${DISCREPANCY_THRESHOLD_PERCENT}% ` +
                  `(base conservée / priorité BRVM>Sika>Rich). Ex. ${reconciled.discrepancies
                    .slice(0, 3)
                    .map(
                      (d) =>
                        `${d.date}: retained ${d.retainedSource}=${d.retainedValue} vs ${d.rejectedSource}=${d.rejectedValue} (${d.deltaPercent}%)`
                    )
                    .join(" | ")}`
              );
            }
          }
        }
      }
    }
  }

  // Même sans densification : un point seed aberrant peut créer le même artefact.
  series = dedupeChartPointsByDay(
    stripIsolatedPriceSpikes(series).map((p) => ({
      time: p.time,
      value: p.value,
      volume: p.volume ?? null,
    }))
  );

  const yearsSet = new Set<number>();
  const pricesByYear: Record<number, number> = {};
  const dividendsByYear: Record<number, number> = {};
  for (const p of series) {
    const y = Number(p.time.slice(0, 4));
    yearsSet.add(y);
    pricesByYear[y] = p.value;
  }
  for (const d of dividends) {
    yearsSet.add(d.year);
    dividendsByYear[d.year] = Number(d.amount);
  }
  const years = [...yearsSet].sort((a, b) => a - b);
  const metrics = calcMetrics({
    years,
    prices: pricesByYear,
    dividends: dividendsByYear,
    per: ratio?.per != null ? Number(ratio.per) : 0,
    mktcap: ratio?.mktCap != null ? Number(ratio.mktCap) : undefined,
    sector: company.sector?.name,
    closes: series,
  });

  const lastDb = dbSeries[dbSeries.length - 1] ?? null;
  const dbSources = [...new Set(dbSeries.map((p) => p.source))];
  const historyFirstDate = series[0]?.time ?? null;
  const historyLastDate = series[series.length - 1]?.time ?? null;
  const historyPoints = series.length;
  const windowed = applyChartSeriesWindow(series, windowQuery);
  const last = series[series.length - 1] ?? null;
  const prev = series.length >= 2 ? series[series.length - 2]! : null;
  const dayChange =
    last && prev && prev.value > 0
      ? Math.round(((last.value - prev.value) / prev.value) * 10000) / 100
      : null;
  const dayChangeAbs = last && prev ? Math.round((last.value - prev.value) * 100) / 100 : null;

  let change1Y: number | null = null;
  if (last) {
    const target = new Date(last.time);
    target.setUTCFullYear(target.getUTCFullYear() - 1);
    const targetIso = target.toISOString().slice(0, 10);
    let ref = series[0]!;
    for (const p of series) {
      if (p.time <= targetIso) ref = p;
      else break;
    }
    if (ref.value > 0) change1Y = Math.round(((last.value - ref.value) / ref.value) * 10000) / 100;
  }

  const windowStart = windowed.series[0]?.time;
  const intervalHint = (windowQuery.interval ?? "1D") as CandleInterval;
  let lookback: typeof series = [];
  let lookbackExhausted = windowed.range === "MAX";
  if (windowStart && windowed.range !== "MAX") {
    const sliced = sliceContiguousLookback(series, windowStart, {
      maxDays: lookbackDaysForInterval(intervalHint),
      maxPoints: 800,
    });
    lookback = sliced.points;
    lookbackExhausted = sliced.exhausted;
  }

  return apiSuccess(
    {
      ticker: company.ticker,
      name: company.name,
      color: company.color,
      country: company.country.name,
      countryFlag: company.country.flagEmoji,
      sector: company.sector.name,
      series: windowed.series.map(({ time, value, volume }) => ({ time, value, volume })),
      lookback: lookback.map(({ time, value, volume }) => ({ time, value, volume })),
      fundamentals: {
        per: ratio?.per != null ? Number(ratio.per) : null,
        mktCapMds: ratio?.mktCap != null ? Number(ratio.mktCap) : null,
        dividendYieldPercent:
          typeof metrics.dividendYieldPercent === "number"
            ? metrics.dividendYieldPercent
            : metrics.dividendYieldPercent === "0"
              ? 0
              : Number(metrics.dividendYieldPercent) || null,
      },
      stats: {
        lastClose: last?.value ?? null,
        lastDate: last?.time ?? null,
        firstDate: windowed.series[0]?.time ?? historyFirstDate,
        points: windowed.series.length,
        historyPoints,
        historyFirstDate,
        historyLastDate,
        range: windowed.range,
        from: windowed.from,
        to: windowed.to,
        lookbackExhausted,
        dayChangePercent: dayChange,
        dayChangeAbs,
        change1YPercent: change1Y,
        lastVolume: last?.volume ?? null,
        source: lastDb?.source ?? null,
        seriesSources: dbSources,
        seriesEnriched:
          seriesSourceNote === "multi_source_merged" || dbSources.length > 1,
        reconciliation: {
          thresholdPercent: DISCREPANCY_THRESHOLD_PERCENT,
          discrepanciesCount,
          densifySources,
          priority: ["BRVM_OFFICIEL", "SIKAFINANCE", "RICHBOURSE"],
        },
      },
      analysis: {
        signalLabel: metrics.signal.label,
        signalColor: metrics.signal.color,
        score: metrics.score,
        technicalScore: metrics.technicalScore,
        fundamentalScore: metrics.fundamentalScore,
        confidence: metrics.confidence,
        signalSummary: metrics.signalSummary,
        technical: metrics.technical,
        horizonScores: metrics.horizonScores,
        riskTier: metrics.riskAnalysis.riskTier,
        riskScore: metrics.riskAnalysis.riskScore,
      },
    },
    { headers: cacheHeaders(120) }
  );
}
