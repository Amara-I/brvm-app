// Annuaire des sociétés cotées NGX : une lecture légère (sociétés actives + derniers cours),
// mise en cache 10 min et invalidée par l'étiquette `ngx-market`. Aucun `take`/`distinct`
// Prisma imbriqué : les cours viennent de getMarketLatestQuotes (SQL LATERAL).

import { prisma } from "@/lib/prisma";
import { cachedLoader, NGX_MARKET_REVALIDATE_S, NGX_MARKET_TAG } from "@/lib/cache/market-cache";
import { parseNgxProfileMeta } from "@/lib/ngx/fundamentals";
import { marketCapBn } from "@/lib/ngx/valuation";
import { getMarketLatestQuotes } from "@/lib/quotes/latest-quotes";
import type { LatestQuote } from "@/lib/quotes/types";
import { ngxCompanyDisplayName } from "@/lib/ngx/official-names";
import { ngxSectorGroup, ngxSectorGroupSlug, NGX_SECTOR_GROUPS } from "@/lib/ngx/sectors";
import type { NgxListedCompaniesData, NgxListedCompanyRow, NgxListedSectorCount } from "./ngx-listed-companies-core";

export type {
  NgxListedCompaniesData,
  NgxListedCompanyRow,
  NgxListedSectorCount,
} from "./ngx-listed-companies-core";
export { filterNgxListedRows, groupNgxListedRows } from "./ngx-listed-companies-core";

export function buildNgxListedCompanies(
  companies: ReadonlyArray<{
    ticker: string;
    name: string;
    sectorSlug: string;
    sectorName: string;
    profileMeta: unknown;
  }>,
  quotes: ReadonlyArray<Pick<LatestQuote, "ticker" | "close" | "changePercent" | "date">>,
): NgxListedCompaniesData {
  const quoteByTicker = new Map(quotes.map((quote) => [quote.ticker, quote] as const));
  const rows: NgxListedCompanyRow[] = companies.map((company) => {
    const quote = quoteByTicker.get(company.ticker);
    const close = quote != null && quote.close > 0 ? quote.close : null;
    const shares = parseNgxProfileMeta(company.profileMeta).sharesOutstanding?.value ?? null;
    const category = ngxSectorGroup(company.ticker, company.sectorSlug || company.sectorName);
    return {
      ticker: company.ticker,
      name: ngxCompanyDisplayName(company.ticker, company.name),
      sectorSlug: company.sectorSlug,
      sectorName: company.sectorName,
      category,
      categorySlug: ngxSectorGroupSlug(category),
      close,
      changePercent: quote?.changePercent ?? null,
      marketCapBn: marketCapBn(close, shares),
      sessionDate: quote?.date ?? null,
    };
  });

  const sectorMap = new Map<string, NgxListedSectorCount>();
  for (const row of rows) {
    const current = sectorMap.get(row.categorySlug) ?? {
      slug: row.categorySlug,
      group: row.category,
      name: row.category,
      count: 0,
    };
    current.count += 1;
    sectorMap.set(row.categorySlug, current);
  }
  const sectors = NGX_SECTOR_GROUPS.map((group) => sectorMap.get(ngxSectorGroupSlug(group))).filter(
    (sector): sector is NgxListedSectorCount => sector != null && sector.count > 0,
  );

  const sessionDate = rows.reduce<string | null>((max, row) => {
    if (!row.sessionDate) return max;
    return !max || row.sessionDate > max ? row.sessionDate : max;
  }, null);

  const caps = rows
    .map((row) => row.marketCapBn)
    .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
  const totalCapBn = caps.length > 0 ? caps.reduce((sum, value) => sum + value, 0) : null;

  return { rows, sectors, sessionDate, totalCapBn };
}

async function loadNgxListedCompaniesUncached(): Promise<NgxListedCompaniesData> {
  const [companies, quotesPayload] = await Promise.all([
    prisma.company.findMany({
      where: { exchange: "NGX", isActive: true },
      orderBy: { ticker: "asc" },
      select: {
        ticker: true,
        name: true,
        profileMeta: true,
        sector: { select: { slug: true, name: true } },
      },
    }),
    getMarketLatestQuotes("NGX"),
  ]);
  return buildNgxListedCompanies(
    companies.map((company) => ({
      ticker: company.ticker,
      name: company.name,
      sectorSlug: company.sector.slug,
      sectorName: company.sector.name,
      profileMeta: company.profileMeta,
    })),
    quotesPayload.quotes,
  );
}

/** Annuaire NGX, cache 10 min, invalidé après chaque ingestion / rafraîchissement des cours. */
export const loadNgxListedCompanies: () => Promise<NgxListedCompaniesData> = cachedLoader(
  loadNgxListedCompaniesUncached,
  ["ngx-listed-companies-v1"],
  { revalidate: NGX_MARKET_REVALIDATE_S, tags: [NGX_MARKET_TAG] },
);
