// Écran de tri NGX : une note par société, calculée avec exactement le même code que la fiche
// (buildNgxSheet → lib/ngx/score.ts), pour que l'écran de tri et la section 8 de la fiche affichent les mêmes chiffres.
// Lecture seule. Les cours viennent du cache `chart_series` (fenêtre 1A + 420 jours de marge, déjà ajustée
// des opérations sur titres) ; à défaut, de la série canonique présentée.

import { prisma } from "@/lib/prisma";
import { adjustSeries, adjustmentFingerprint } from "@/lib/corporate-actions/adjust";
import { actionsByTicker } from "@/lib/corporate-actions/load";
import { presentCompanyCloses } from "@/lib/corporate-actions/present-series";
import { fromCompactPoints, type ChartSeriesMetaPayload } from "@/lib/charts/chart-series-cache";
import type { ChartClosePoint } from "@/lib/charts/indicators";
import { PORTFOLIO_TYPE_IDS, type PortfolioTypeId } from "@/lib/portfolio-types/constants";
import { buildNgxSheet, computeCompanyMetrics } from "@/lib/ngx/sheet-model";
import { policyScore, type NgxPillarKey, type NgxScoreBand, type NgxScoreConfidence, type NgxScoreMode } from "@/lib/ngx/score";
import { NGX_PILLAR_KEYS } from "@/lib/ngx/score";
import { ngxSectorGroup, cleanNgxName, type NgxSectorGroup } from "@/lib/ngx/sectors";
import { loadNgxUniverse } from "./ngx-sheet";

export interface NgxScreenerRow {
  ticker: string;
  name: string;
  sectorSlug: string;
  sectorName: string;
  sectorGroup: NgxSectorGroup;
  close: number | null;
  marketCapBn: number | null;
  per: number | null;
  pbr: number | null;
  yieldPercent: number | null;
  roePercent: number | null;
  return3mPercent: number | null;
  return1yPercent: number | null;
  /** Fondamentaux exploitables (comptes à jour) ; false = lecture graphique seule. */
  hasFundamentals: boolean;
  staleAccountsYear: number | null;
  mode: NgxScoreMode;
  confidence: NgxScoreConfidence;
  band: NgxScoreBand | null;
  overall: number | null;
  policies: Record<PortfolioTypeId, number | null>;
  pillars: Record<NgxPillarKey, number | null>;
}

export interface NgxScreenerData {
  rows: NgxScreenerRow[];
  /** Sociétés actives, notées avec fondamentaux (FULL + PARTIAL), notées sur le graphique seul, non notées. */
  coverage: { total: number; fundamentals: number; full: number; partial: number; chartOnly: number; unscored: number };
  asOf: string;
}

const ONE_YEAR_MS = 400 * 24 * 3600 * 1000;

async function loadSeries(
  rows: Array<{ id: string; ticker: string }>,
  closes: Map<string, number | null>,
): Promise<Map<string, ChartClosePoint[]>> {
  const out = new Map<string, ChartClosePoint[]>();
  const [cached, actions] = await Promise.all([
    prisma.chartSeries
      .findMany({
        where: { kind: "COMPANY", exchange: "NGX", rangeKey: "1A" },
        select: { symbol: true, points: true, pointCount: true, meta: true },
      })
      .catch(() => []),
    actionsByTicker().catch(() => new Map()),
  ]);
  for (const row of cached) {
    if (row.pointCount === 0) continue;
    const acts = actions.get(row.symbol) ?? [];
    const meta = (row.meta ?? null) as ChartSeriesMetaPayload | null;
    const points = fromCompactPoints(row.points);
    out.set(row.symbol, meta?.adjustmentFingerprint === adjustmentFingerprint(acts) ? points : adjustSeries(points, acts));
  }
  // Sociétés cotées sans ligne de cache : série canonique récente, ajustée comme sur la fiche.
  const missing = rows.filter((r) => !out.has(r.ticker) && closes.get(r.ticker) != null);
  for (const r of missing) {
    const prices = await prisma.priceHistory.findMany({
      where: { companyId: r.id, isCanonical: true, date: { gte: new Date(Date.now() - ONE_YEAR_MS - 420 * 24 * 3600 * 1000) } },
      orderBy: { date: "asc" },
      select: { date: true, closePrice: true, volume: true },
    });
    const raw: ChartClosePoint[] = prices
      .map((p) => ({
        time: p.date.toISOString().slice(0, 10),
        value: Number(p.closePrice),
        volume: p.volume != null ? Number(p.volume) : null,
      }))
      .filter((p) => p.value > 0);
    if (raw.length === 0) continue;
    const presented = await presentCompanyCloses(prisma, r.id, r.ticker, raw);
    out.set(r.ticker, presented.points);
  }
  return out;
}

export async function loadNgxScreener(): Promise<NgxScreenerData> {
  const today = new Date().toISOString().slice(0, 10);
  const { rows, universe } = await loadNgxUniverse();
  const closes = new Map(universe.map((c) => [c.ticker, c.close] as const));
  const seriesByTicker = await loadSeries(rows, closes);
  const universeMetrics = universe.map((c) => ({ c, m: computeCompanyMetrics(c, today) }));

  const out: NgxScreenerRow[] = universe.map((company, i) => {
    const series = (seriesByTicker.get(company.ticker) ?? []).map((p) => ({
      time: p.time,
      value: p.value,
      volume: p.volume ?? null,
    }));
    const model = buildNgxSheet({
      company,
      previousClose: null,
      changePercent: null,
      volume: null,
      sessionDate: null,
      indicativeFcfa: null,
      series,
      events: [],
      documents: [],
      universe,
      universeMetrics,
      today,
    });
    const m = universeMetrics[i].m;
    const score = model.score;
    return {
      ticker: company.ticker,
      name: cleanNgxName(company.name),
      sectorSlug: company.sectorSlug,
      sectorName: company.sectorName,
      sectorGroup: ngxSectorGroup(company.ticker, company.sectorSlug || company.sectorName),
      close: company.close,
      marketCapBn: m.marketCapBn,
      per: m.per,
      pbr: m.pbr,
      yieldPercent: model.dividends.currentYieldPercent,
      roePercent: m.roePercent,
      return3mPercent: model.price.stats.return3mPercent,
      return1yPercent: model.price.stats.return1yPercent,
      hasFundamentals: score.mode === "FULL" || score.mode === "PARTIAL",
      staleAccountsYear: score.staleAccountsYear,
      mode: score.mode,
      confidence: score.confidence,
      band: score.band,
      overall: score.overall,
      policies: Object.fromEntries(PORTFOLIO_TYPE_IDS.map((t) => [t, policyScore(score, t).score])) as Record<PortfolioTypeId, number | null>,
      pillars: Object.fromEntries(NGX_PILLAR_KEYS.map((k) => [k, score.pillars[k].score])) as Record<NgxPillarKey, number | null>,
    };
  });

  const count = (mode: NgxScoreMode) => out.filter((r) => r.mode === mode).length;
  const full = count("FULL");
  const partial = count("PARTIAL");
  const chartOnly = out.filter((r) => r.mode === "CHART_ONLY" && r.overall != null).length;
  return {
    rows: out,
    coverage: {
      total: out.length,
      fundamentals: full + partial,
      full,
      partial,
      chartOnly,
      unscored: out.length - full - partial - chartOnly,
    },
    asOf: today,
  };
}

/** Classement global : seuls les titres notés avec fondamentaux y figurent (jamais le graphique seul). */
export function rankedByOverall(rows: NgxScreenerRow[]): NgxScreenerRow[] {
  return rows
    .filter((r) => r.hasFundamentals && r.overall != null)
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0) || (b.marketCapBn ?? 0) - (a.marketCapBn ?? 0));
}
