// Données du graphe NGX : cours des sociétés (clôtures canoniques ajustées des splits)
// et niveaux des indices NGX (ASI, NGX30, sectoriels…), lecture seule.

import { prisma } from "@/lib/prisma";
import { presentCompanyCloses } from "@/lib/corporate-actions/present-series";
import type { ChartClosePoint } from "@/lib/charts/indicators";
import { buildNgxChartPayload, type NgxChartPayloadQuery } from "@/lib/charts/ngx-chart-payload";
import type { ChartUniverseItem } from "@/components/charts/ChartWorkbench";
import { parseNgxProfileMeta } from "@/lib/ngx/fundamentals";

const NGX_FLAG = "🇳🇬";
const INDEX_COLOR = "#D4A843";
/** Un indice dont le dernier niveau a plus de 120 jours d'écart avec le plus récent est écarté de la comparaison. */
const STALE_INDEX_DAYS = 120;

export async function loadNgxChartPayload(rawSymbol: string, query: NgxChartPayloadQuery) {
  const symbol = rawSymbol.toUpperCase();

  const company = await prisma.company.findFirst({
    where: { ticker: symbol, exchange: "NGX", isActive: true },
    select: {
      id: true,
      ticker: true,
      name: true,
      color: true,
      profileMeta: true,
      sector: { select: { name: true } },
    },
  });

  if (company) {
    const prices = await prisma.priceHistory.findMany({
      where: { companyId: company.id, isCanonical: true },
      orderBy: { date: "asc" },
      select: { date: true, closePrice: true, volume: true, source: true },
    });
    const raw: ChartClosePoint[] = prices
      .map((row) => ({
        time: row.date.toISOString().slice(0, 10),
        value: Number(row.closePrice),
        volume: row.volume != null ? Number(row.volume) : null,
      }))
      .filter((point) => point.value > 0);
    const presented = await presentCompanyCloses(prisma, company.id, company.ticker, raw);
    return buildNgxChartPayload(
      {
        kind: "company",
        symbol: company.ticker,
        name: company.name,
        color: company.color || INDEX_COLOR,
        sector: company.sector.name,
        series: presented.points,
        actions: presented.actions,
        source: prices[prices.length - 1]?.source ?? null,
        sources: [...new Set(prices.map((row) => row.source))],
        sharesOutstanding: parseNgxProfileMeta(company.profileMeta).sharesOutstanding?.value ?? null,
      },
      query
    );
  }

  const index = await prisma.marketIndex.findUnique({ where: { code: symbol } });
  if (!index || index.exchange !== "NGX") return null;
  const values = await prisma.marketIndexValue.findMany({
    where: { marketIndexId: index.id, isCanonical: true },
    orderBy: { date: "asc" },
    select: { date: true, value: true, source: true },
  });
  const series: ChartClosePoint[] = values
    .map((row) => ({ time: row.date.toISOString().slice(0, 10), value: Number(row.value), volume: null }))
    .filter((point) => point.value > 0);
  return buildNgxChartPayload(
    {
      kind: "index",
      symbol: index.code,
      name: index.name,
      color: INDEX_COLOR,
      sector: "NGX",
      series,
      actions: [],
      source: values[values.length - 1]?.source ?? null,
      sources: [...new Set(values.map((row) => row.source))],
      sharesOutstanding: null,
    },
    query
  );
}

/**
 * Univers de comparaison NGX : indices d'abord (ASI en tête), puis les sociétés cotées.
 * Les indices dont les niveaux ne sont plus publiés sont écartés.
 */
export async function loadNgxChartUniverse(): Promise<ChartUniverseItem[]> {
  const [indices, companies] = await Promise.all([
    prisma.marketIndex.findMany({
      where: { exchange: "NGX" },
      select: {
        code: true,
        name: true,
        values: { where: { isCanonical: true }, orderBy: { date: "desc" }, take: 1, select: { date: true } },
      },
    }),
    prisma.company.findMany({
      where: { exchange: "NGX", isActive: true },
      select: { ticker: true, name: true, color: true, sector: { select: { name: true } } },
      orderBy: { ticker: "asc" },
    }),
  ]);

  const newest = indices.reduce((max, row) => {
    const d = row.values[0]?.date.getTime() ?? 0;
    return d > max ? d : max;
  }, 0);
  const live = indices
    .filter((row) => {
      const d = row.values[0]?.date.getTime();
      return d != null && newest - d <= STALE_INDEX_DAYS * 86_400_000;
    })
    .sort((a, b) => {
      if (a.code === "NGX_ASI") return -1;
      if (b.code === "NGX_ASI") return 1;
      return a.code.localeCompare(b.code);
    });

  return [
    ...live.map(
      (row): ChartUniverseItem => ({
        ticker: row.code,
        name: row.name,
        color: INDEX_COLOR,
        sector: "NGX",
        countryFlag: NGX_FLAG,
        kind: "index",
      })
    ),
    ...companies.map(
      (row): ChartUniverseItem => ({
        ticker: row.ticker,
        name: row.name,
        color: row.color || INDEX_COLOR,
        sector: row.sector.name,
        countryFlag: NGX_FLAG,
        kind: "company",
      })
    ),
  ];
}
