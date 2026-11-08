import type { InvestorCriteria } from "./criteria";

/** Plafonds indicatifs, en % du capital analysé. Jamais une interdiction. */
export interface ConcentrationLimits {
  stockPct: number;
  sectorPct: number;
  countryPct: number;
  marketPct: number;
}

export const LIMIT_PRESETS = {
  strict: { stockPct: 10, sectorPct: 25, countryPct: 40, marketPct: 70 },
  moderate: { stockPct: 15, sectorPct: 35, countryPct: 50, marketPct: 80 },
  loose: { stockPct: 20, sectorPct: 40, countryPct: 60, marketPct: 90 },
} as const satisfies Record<string, ConcentrationLimits>;

/**
 * Le plus prudent l'emporte : rente, préservation, tolérance faible ou
 * capacité modeste restent au palier strict même si un autre critère est offensif.
 * Sans critère, palier modéré.
 */
export function concentrationLimits(profile: InvestorCriteria): ConcentrationLimits {
  const strict =
    profile.lossTolerance === "FAIBLE" ||
    profile.portfolioType === "RENTE" ||
    profile.objective === "PRESERVATION" ||
    profile.capacity === "MODESTE";
  if (strict) return { ...LIMIT_PRESETS.strict };

  const loose =
    profile.lossTolerance === "ELEVEE" ||
    profile.portfolioType === "TRADING" ||
    profile.portfolioType === "CROISSANCE_MAX" ||
    profile.objective === "CROISSANCE_AGRESSIVE";
  if (loose) return { ...LIMIT_PRESETS.loose };
  return { ...LIMIT_PRESETS.moderate };
}

export type WeightKind = "stock" | "sector" | "country" | "market";

export interface WeightBucket {
  kind: WeightKind;
  key: string;
  label: string;
  weightPct: number;
  limitPct: number;
  above: boolean;
}

export function weightBuckets(input: {
  holdings: Array<{
    ticker: string;
    name: string;
    sector: string;
    country: string;
    market: "BRVM" | "NGX";
    valueFcfa: number;
  }>;
  limits: ConcentrationLimits;
}): WeightBucket[] {
  const total = input.holdings.reduce((sum, holding) => sum + holding.valueFcfa, 0);
  if (!(total > 0)) return [];

  const buckets: WeightBucket[] = [];
  const pushGroup = (
    kind: WeightKind,
    groups: Map<string, { label: string; value: number }>,
    limitPct: number
  ) => {
    for (const [key, group] of groups) {
      const weightPct = (group.value / total) * 100;
      buckets.push({
        kind,
        key,
        label: group.label,
        weightPct,
        limitPct,
        above: weightPct > limitPct + 1e-9,
      });
    }
  };

  const stocks = new Map<string, { label: string; value: number }>();
  const sectors = new Map<string, { label: string; value: number }>();
  const countries = new Map<string, { label: string; value: number }>();
  const markets = new Map<string, { label: string; value: number }>();

  for (const holding of input.holdings) {
    const stock = stocks.get(holding.ticker) ?? { label: `${holding.ticker} · ${holding.name}`, value: 0 };
    stock.value += holding.valueFcfa;
    stocks.set(holding.ticker, stock);

    const sector = sectors.get(holding.sector) ?? { label: holding.sector, value: 0 };
    sector.value += holding.valueFcfa;
    sectors.set(holding.sector, sector);

    const country = countries.get(holding.country) ?? { label: holding.country, value: 0 };
    country.value += holding.valueFcfa;
    countries.set(holding.country, country);

    const market = markets.get(holding.market) ?? { label: holding.market, value: 0 };
    market.value += holding.valueFcfa;
    markets.set(holding.market, market);
  }

  pushGroup("stock", stocks, input.limits.stockPct);
  pushGroup("sector", sectors, input.limits.sectorPct);
  pushGroup("country", countries, input.limits.countryPct);
  pushGroup("market", markets, input.limits.marketPct);
  return buckets;
}
