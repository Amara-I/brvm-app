import { describe, expect, it } from "vitest";
import { getPortfolioTypeDef } from "@/lib/portfolio-types/catalog";
import { concludeForPolicy, type PolicyFacts } from "@/lib/ngx/policy";
import { priceStats } from "@/lib/ngx/price-stats";
import {
  BRVM_VALUE_BANDS,
  analysisFromSheet,
  buildBrvmFundamentalAnalysis,
  readBrvmLiquidity,
  type BrvmFundamentalInput,
  type BrvmSheetSlice,
} from "./brvm-analysis";

function day(index: number): string {
  const d = new Date(Date.UTC(2024, 0, 1));
  d.setUTCDate(d.getUTCDate() + index);
  return d.toISOString().slice(0, 10);
}

/** `zeroShare` : part des premières séances dont le volume est à 0 (les suivantes échangent `volume`). */
function series(count: number, price: number, volume: number | null, zeroShare = 0) {
  return Array.from({ length: count }, (_, i) => ({
    time: day(i),
    value: price * (1 + i * 0.0004),
    volume: volume == null ? null : i / count < zeroShare ? 0 : volume,
  }));
}

function input(over: Partial<BrvmFundamentalInput> = {}): BrvmFundamentalInput {
  return {
    ticker: "SNTS",
    name: "Sonatel",
    sector: "Télécommunications",
    description: "Opérateur télécom.",
    isin: "SN0000000019",
    listedSince: "1998-10-02",
    sharesOutstanding: 100_000_000,
    close: 20_000,
    per: 12,
    mktcap: 2_000,
    roe: 18,
    netMargin: 16,
    debtRatio: 25,
    pbRatio: 2,
    revenueGrowth: 11,
    fcf: 80,
    income: [
      { year: 2022, revenue: 100, netIncome: 16, operatingIncome: 22 },
      { year: 2023, revenue: 112, netIncome: 18, operatingIncome: 25 },
      { year: 2024, revenue: 130, netIncome: 22, operatingIncome: 30 },
      { year: 2025, revenue: 150, netIncome: 28, operatingIncome: 36 },
    ],
    dividends: [2021, 2022, 2023, 2024, 2025].map((year) => ({
      year,
      amount: 800 + (year - 2021) * 50,
      exDate: `${year}-06-01`,
      paymentDate: `${year}-07-01`,
      source: "BRVM officiel",
    })),
    series: series(80, 20_000, 8_000),
    outlook: {
      summary: {
        fr: { bullets: ["Poursuite des investissements réseau."], watch: ["Pression concurrentielle."] },
        en: { bullets: ["Network investment continues."], watch: ["Competitive pressure."] },
      },
      items: [
        {
          type: "project",
          textFr: "Déploiement fibre.",
          textEn: "Fibre rollout.",
          date: "2025-03",
          sourceName: "Rapport annuel",
          url: "https://www.sonatel.sn/rapport",
          confidence: "high",
        },
      ],
      updatedAt: "2026-01-15T00:00:00.000Z",
    },
    universe: [
      { ticker: "SNTS", sector: "Télécommunications", per: 12, mktcap: 2000, pbRatio: 2, roe: 18, netMargin: 16, revenueGrowth: 11, close: 20000, dividend: 1000 },
      { ticker: "ORAC", sector: "Télécommunications", per: 10, mktcap: 400, pbRatio: 1.5, roe: 14, netMargin: 12, revenueGrowth: 8, close: 5000, dividend: 200 },
      { ticker: "ONTBF", sector: "Télécommunications", per: 9, mktcap: 300, pbRatio: 1.2, roe: 12, netMargin: 10, revenueGrowth: 6, close: 3000, dividend: 100 },
      { ticker: "ABJC", sector: "Télécommunications", per: 14, mktcap: 250, pbRatio: 2.4, roe: 15, netMargin: 11, revenueGrowth: 9, close: 8000, dividend: 300 },
      { ticker: "PALC", sector: "Télécommunications", per: 11, mktcap: 180, pbRatio: 1.8, roe: 13, netMargin: 9, revenueGrowth: 4, close: 4000, dividend: 150 },
      { ticker: "SGBC", sector: "Services Financiers", per: 6, mktcap: 900, pbRatio: 1, roe: 20, netMargin: 30, revenueGrowth: 5, close: 20000, dividend: 1000 },
    ],
    today: "2026-11-08",
    ...over,
  };
}

describe("liquidité BRVM", () => {
  it("signale un titre actif comme liquide, sans inventer un volume", () => {
    const reading = readBrvmLiquidity(series(80, 20_000, 8_000));
    expect(reading.level).toBe("OK");
    expect(reading.illiquid).toBe(false);
    expect(reading.avgDailyValueFcfa).toBeGreaterThan(BRVM_VALUE_BANDS.ok);
  });

  it("signale peu liquide quand beaucoup de séances sont sans échange", () => {
    const reading = readBrvmLiquidity(series(60, 20_000, 5_000, 0.7));
    expect(reading.illiquid).toBe(true);
    expect(reading.reasons).toContain("noTrade");
    expect(reading.level).toBe("ILLIQUID");
  });

  it("reste N/D quand aucun volume n'est connu", () => {
    const reading = readBrvmLiquidity(series(60, 5_000, null));
    expect(reading.level).toBe("ND");
    expect(reading.illiquid).toBe(false);
    expect(reading.avgShareVolume).toBeNull();
  });
});

describe("analyse fondamentale BRVM", () => {
  it("couvre les 8 étapes et ne fabrique pas de BPA sans titres", () => {
    const model = buildBrvmFundamentalAnalysis(input());
    expect(model.steps.map((s) => s.id)).toEqual([
      "presentation",
      "performance",
      "outlook",
      "price",
      "valuation",
      "sector",
      "dividends",
      "conclusion",
    ]);
    expect(model.presentation.marketCapBn).toBe(2000);
    expect(model.price.impliedEps).toBeCloseTo((28 * 1e9) / 100_000_000);
    expect(model.price.per.value).toBe(12);
    expect(model.outlook.synthesis?.items[0]?.sourceName).toBe("Rapport annuel");
    expect(model.dividends.currentStatus).toBe("CONFIRMED");
    expect(model.dividends.currentYieldPercent).toBeGreaterThan(0);
    expect(model.sector.rows.find((r) => r.key === "per")?.stat.n).toBe(4);
    expect(model.valuation.summary.verdict).not.toBe("UNKNOWN");
    expect(model.liquidity.illiquid).toBe(false);

    const bare = buildBrvmFundamentalAnalysis(
      input({
        sharesOutstanding: null,
        per: 0,
        mktcap: 0,
        roe: null,
        netMargin: null,
        debtRatio: null,
        pbRatio: null,
        revenueGrowth: null,
        fcf: null,
        income: [],
        dividends: [],
        outlook: null,
        description: null,
        isin: null,
        listedSince: null,
        close: null,
        series: [],
        universe: [],
      }),
    );
    expect(bare.price.impliedEps).toBeNull();
    expect(bare.price.per.status).toBe("unavailable");
    expect(bare.valuation.estimates).toEqual([]);
    expect(bare.valuation.summary.verdict).toBe("UNKNOWN");
    expect(bare.steps.find((s) => s.id === "performance")?.verdict).toBe("missing");
    expect(bare.steps.find((s) => s.id === "outlook")?.verdict).toBe("missing");
    expect(bare.steps.find((s) => s.id === "dividends")?.verdict).toBe("missing");
    expect(bare.dividends.currentDps).toBeNull();
    expect(bare.policies.every((p) => p.verdict === "INSUFFICIENT")).toBe(true);
  });

  it("écarte des comptes trop anciens au lieu de les traiter comme actuels", () => {
    const model = buildBrvmFundamentalAnalysis(
      input({
        today: "2026-11-08",
        income: [{ year: 2022, revenue: 40, netIncome: 5, operatingIncome: 8 }],
        per: 8,
        roe: 22,
      }),
    );
    expect(model.staleAccountsYear).toBe(2022);
    expect(model.price.per.status).toBe("stale");
    expect(model.price.per.value).toBeNull();
    expect(model.price.impliedEps).toBeNull();
    expect(model.steps.find((s) => s.id === "performance")?.verdict).toBe("stale");
    const growth = model.policies.find((p) => p.type === "CROISSANCE")!;
    expect(growth.criteria.find((c) => c.key === "revenueGrowth")?.status).toBe("ND");
  });

  it("remonte le drapeau de liquidité dans le prix et la conclusion par politique", () => {
    const model = buildBrvmFundamentalAnalysis(input({ series: series(60, 20_000, 5_000, 0.7), close: 20_000 }));
    expect(model.liquidity.illiquid).toBe(true);
    expect(model.steps.find((s) => s.id === "price")?.verdict).toBe("illiquid");
    const trading = model.policies.find((p) => p.type === "TRADING")!;
    expect(trading.criteria.find((c) => c.key === "liquidity")?.status).toBe("KO");
    const max = model.policies.find((p) => p.type === "CROISSANCE_MAX")!;
    expect(max.criteria.find((c) => c.key === "liquidity")?.status).toBe("KO");
  });

  it("ne change pas le jugement de liquidité NGX quand aucun override n'est fourni", () => {
    const liquidNgx = priceStats(series(80, 100, 2_000_000));
    const facts: PolicyFacts = {
      revenueCagrPercent: null,
      growthSpanYears: 0,
      netIncomeCagrPercent: null,
      latestNetIncomeBn: null,
      roePercent: null,
      profitableYears: 0,
      knownYears: 0,
      valuationVerdict: "UNKNOWN",
      dividendYieldPercent: null,
      dividendYearsPaid: null,
      dividendWindow: 5,
      payoutPercent: null,
      dividendGrowthPercent: null,
      price: liquidNgx,
    };
    const criterion = concludeForPolicy("TRADING", facts).criteria.find((c) => c.key === "liquidity")!;
    expect(criterion.status).toBe("OK");
    expect(criterion.threshold).toBe(100_000_000);
  });

  it("relie les types adaptés aux horizons du catalogue Éducation", () => {
    const model = buildBrvmFundamentalAnalysis(input());
    expect(model.policies).toHaveLength(4);
    for (const type of model.adapted) {
      const def = getPortfolioTypeDef(type);
      expect(def.horizon.length).toBeGreaterThan(0);
      expect(def.educationHref).toContain("/education/types-de-portefeuille/");
    }
    expect(getPortfolioTypeDef("RENTE").horizon).toMatch(/terme/i);
    expect(getPortfolioTypeDef("TRADING").horizon).toMatch(/Court/i);
    expect(getPortfolioTypeDef("CROISSANCE").horizon).toMatch(/cinq ans/i);
  });

  it("reconstruit l'entrée depuis la fiche, dividendes datés compris", () => {
    const company = {
      ticker: "BNBC",
      name: "BICI Niger",
      sector: "Services Financiers",
      per: 0,
      mktcap: 0,
      roe: null,
      netMargin: null,
      debtRatio: null,
      pbRatio: null,
      revenueGrowth: null,
      fcf: null,
      prices: { 2025: 4000 },
      dividends: { 2023: 100, 2024: 120 },
    };
    const slice: BrvmSheetSlice = {
      company,
      peers: [company],
      incomeStatement: [],
      dividendSchedule: [
        { year: 2024, amount: 125, exDate: "2025-06-12", paymentDate: "2025-07-20", source: "BRVM officiel" },
      ],
      outlook: null,
      series: [],
      description: null,
      isin: null,
      listedSince: null,
      profileMeta: { sharesOutstanding: null },
      sessionDate: "2026-11-01",
    };
    const model = analysisFromSheet(slice, null, "2026-11-08");
    expect(model.price.close).toBe(4000);
    expect(model.price.impliedEps).toBeNull();
    const line = model.dividends.lines.find((l) => l.year === 2024);
    expect(line?.dps).toBe(125);
    expect(line?.source).toBe("BRVM officiel");
    expect(model.dividends.lines.find((l) => l.year === 2023)?.dps).toBe(100);
    expect(model.steps.find((s) => s.id === "outlook")?.tone).toBe("nd");
  });
});
