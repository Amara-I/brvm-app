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

  it("ouvre une fourchette réelle pour Sonatel : PER sectoriel, rendement et PER historique", () => {
    const model = buildBrvmFundamentalAnalysis(
      input({
        sector: "Télécoms",
        close: 4_000,
        per: 9.67,
        mktcap: 4_000,
        sharesOutstanding: 1_000_000_000,
        pbRatio: null,
        netMargin: 21.51,
        revenueGrowth: 8.26,
        income: [
          { year: 2023, revenue: 1620.7, netIncome: 331.75, operatingIncome: null },
          { year: 2024, revenue: 1776.44, netIncome: 393.66, operatingIncome: null },
          { year: 2025, revenue: 1923.12, netIncome: 413.59, operatingIncome: null },
        ],
        dividends: [
          { year: 2021, amount: 140, exDate: null, paymentDate: null, source: "BRVM officiel" },
          { year: 2022, amount: 150, exDate: null, paymentDate: null, source: "BRVM officiel" },
          { year: 2023, amount: 157.5, exDate: null, paymentDate: null, source: "BRVM officiel" },
          { year: 2024, amount: 165.5, exDate: null, paymentDate: null, source: "BRVM officiel" },
          { year: 2025, amount: 174, exDate: null, paymentDate: null, source: "BRVM officiel" },
        ],
        ratioHistory: [
          { year: 2021, per: 15.37, pbRatio: null, roe: null, netMargin: 18.91, debtRatio: null, revenueGrowth: null, fcf: null },
          { year: 2022, per: 13.91, pbRatio: null, roe: null, netMargin: 19.17, debtRatio: null, revenueGrowth: 9, fcf: null },
          { year: 2023, per: 11.7, pbRatio: null, roe: null, netMargin: 20.47, debtRatio: null, revenueGrowth: 11.38, fcf: null },
          { year: 2024, per: 9.86, pbRatio: null, roe: null, netMargin: 22.16, debtRatio: null, revenueGrowth: 9.61, fcf: null },
          { year: 2025, per: 9.38, pbRatio: null, roe: null, netMargin: 21.51, debtRatio: null, revenueGrowth: 8.26, fcf: null },
          { year: 2026, per: 9.67, pbRatio: null, roe: null, netMargin: null, debtRatio: null, revenueGrowth: null, fcf: null },
        ],
        universe: [
          { ticker: "SNTS", name: "Sonatel", sector: "Télécoms", per: 9.67, mktcap: 4000, pbRatio: null, roe: null, netMargin: 21.51, revenueGrowth: 8.26, close: 4000, dividend: 174 },
          { ticker: "ONTBF", name: "ONATEL BF", sector: "Télécoms", per: 14, mktcap: 200, pbRatio: null, roe: null, netMargin: 10.87, revenueGrowth: 3.06, close: 3030, dividend: 145.32 },
          { ticker: "ORAC", name: "Orange CI", sector: "Télécoms", per: 18.94, mktcap: 1500, pbRatio: null, roe: null, netMargin: 14.02, revenueGrowth: 10.42, close: 21000, dividend: 704 },
        ],
      }),
    );
    expect(model.price.impliedEps).toBeCloseTo(413.59, 1);
    expect(model.price.epsBlocked).toBeNull();
    expect(model.valuation.rangeMode).toBe("range");
    expect(model.valuation.summary.low).not.toBe(model.valuation.summary.high);
    const methods = model.valuation.estimates.map((e) => e.method);
    expect(methods).toContain("SECTOR_PER");
    expect(methods).toContain("DIVIDEND_YIELD");
    expect(methods).toContain("HISTORICAL_PE");
    expect(model.valuation.estimates.find((e) => e.method === "SECTOR_PER")!.value).toBeCloseTo(413.59 * 16.47, 0);
    expect(model.valuation.skipped.find((s) => s.method === "SECTOR_PBR")?.reason).toBe("noBook");
    expect(model.valuation.skipped.find((s) => s.method === "DDM")?.reason).toBe("growthAboveYield");
    const perRow = model.sector.rows.find((r) => r.key === "per")!;
    expect(perRow.stat.n).toBe(2);
    expect(perRow.stat.lowConfidence).toBe(true);
    expect(perRow.peers.map((p) => p.ticker).sort()).toEqual(["ONTBF", "ORAC"]);
    expect(perRow.peers.find((p) => p.ticker === "ORAC")?.name).toBe("Orange CI");
    expect(perRow.position).toBe("below");
    expect(perRow.rank).toBe(3);
    expect(perRow.rankedCount).toBe(3);
    expect(model.performance.years.find((y) => y.year === 2025)?.eps).toBeCloseTo(413.59, 1);
    expect(model.performance.years.find((y) => y.year === 2025)?.payoutPercent).toBeCloseTo((174 / 413.59) * 100, 0);
  });

  it("n'utilise pas le PER 676,7 de Bernabé pour le verdict de valorisation", () => {
    const model = buildBrvmFundamentalAnalysis(
      input({
        ticker: "BNBC",
        name: "Bernabé CI",
        sector: "Conso. Discrétionnaire",
        close: 1_895,
        per: 676.7,
        mktcap: 15,
        sharesOutstanding: 6_624_000,
        pbRatio: null,
        roe: null,
        netMargin: 0.05,
        revenueGrowth: -6.31,
        fcf: null,
        income: [
          { year: 2023, revenue: 45.96, netIncome: 0.04, operatingIncome: null },
          { year: 2024, revenue: 45.31, netIncome: 0.01, operatingIncome: null },
          { year: 2025, revenue: 42.45, netIncome: 0.02, operatingIncome: null },
        ],
        dividends: [{ year: 2023, amount: 150, exDate: null, paymentDate: null, source: "BRVM officiel" }],
        ratioHistory: [
          { year: 2021, per: 8.72, pbRatio: null, roe: null, netMargin: 3.6, debtRatio: null, revenueGrowth: null, fcf: null },
          { year: 2022, per: 7.71, pbRatio: null, roe: null, netMargin: 3.52, debtRatio: null, revenueGrowth: 15.66, fcf: null },
          { year: 2023, per: 421, pbRatio: null, roe: null, netMargin: 0.08, debtRatio: null, revenueGrowth: -10.57, fcf: null },
          { year: 2024, per: 1913.64, pbRatio: null, roe: null, netMargin: 0.02, debtRatio: null, revenueGrowth: -1.4, fcf: null },
          { year: 2025, per: 624.63, pbRatio: null, roe: null, netMargin: 0.05, debtRatio: null, revenueGrowth: -6.31, fcf: null },
        ],
        universe: [
          { ticker: "BNBC", name: "Bernabé CI", sector: "Conso. Discrétionnaire", per: 676.7, mktcap: 15, pbRatio: null, roe: null, netMargin: 0.05, revenueGrowth: -6.31, close: 1895, dividend: 150 },
          { ticker: "ABJC", name: "Servair Abidjan", sector: "Conso. Discrétionnaire", per: 32.92, mktcap: 44, pbRatio: null, roe: null, netMargin: 10.16, revenueGrowth: 6.67, close: 3400, dividend: 201.52 },
          { ticker: "CFAC", name: "CFAO Motors CI", sector: "Conso. Discrétionnaire", per: 37.17, mktcap: 314, pbRatio: null, roe: null, netMargin: 4.66, revenueGrowth: 14.04, close: 1255, dividend: 55.44 },
          { ticker: "NEIC", name: "NEI-CEDA CI", sector: "Conso. Discrétionnaire", per: 17.24, mktcap: 35, pbRatio: null, roe: null, netMargin: 39.64, revenueGrowth: -23.8, close: 1850, dividend: 140.4 },
          { ticker: "PRSC", name: "Tractafric Motors CI", sector: "Conso. Discrétionnaire", per: 18.92, mktcap: 45, pbRatio: null, roe: null, netMargin: 2.92, revenueGrowth: 8.64, close: 3620, dividend: 183.92 },
          { ticker: "UNXC", name: "Uniwax CI", sector: "Conso. Discrétionnaire", per: 35.26, mktcap: 49, pbRatio: null, roe: null, netMargin: -2.15, revenueGrowth: 6.21, close: 2020, dividend: 60.75 },
        ],
        outlook: null,
      }),
    );
    expect(model.price.per.status).toBe("outlier");
    expect(model.price.per.value).toBeNull();
    expect(model.price.per.recorded).toBeCloseTo(676.7);
    expect(model.price.epsBlocked).toBe("outlier");
    expect(model.price.impliedPer).toBeGreaterThan(100);
    expect(model.valuation.estimates).toEqual([]);
    expect(model.valuation.summary.verdict).toBe("UNKNOWN");
    expect(model.valuation.summary.gapToMidPercent).toBeNull();
    expect(model.valuation.rangeMode).toBe("none");
    expect(model.valuation.skipped.find((s) => s.method === "SECTOR_PER")?.reason).toBe("outlierEps");
    const perRow = model.sector.rows.find((r) => r.key === "per")!;
    expect(perRow.company).toBeNull();
    expect(perRow.excluded).toBe("outlier");
    expect(perRow.recorded).toBeCloseTo(676.7);
    expect(perRow.stat.n).toBe(5);
    expect(perRow.peers.every((p) => p.included)).toBe(true);
    expect(model.steps.find((s) => s.id === "valuation")?.verdict).toBe("UNKNOWN");
  });

  it("retire un pair au PER extrême de la médiane tout en le listant", () => {
    const model = buildBrvmFundamentalAnalysis(
      input({
        universe: [
          { ticker: "SNTS", name: "Sonatel", sector: "Télécommunications", per: 12, mktcap: 2000, pbRatio: 2, roe: 18, netMargin: 16, revenueGrowth: 11, close: 20000, dividend: 1000 },
          { ticker: "AAAA", name: "Pair sain", sector: "Télécommunications", per: 10, mktcap: 100, pbRatio: 1, roe: 10, netMargin: 8, revenueGrowth: 4, close: 1000, dividend: 40 },
          { ticker: "BBBB", name: "Pair extrême", sector: "Télécommunications", per: 250, mktcap: 50, pbRatio: null, roe: null, netMargin: null, revenueGrowth: null, close: 500, dividend: null },
        ],
      }),
    );
    const perRow = model.sector.rows.find((r) => r.key === "per")!;
    expect(perRow.stat.n).toBe(1);
    expect(perRow.stat.median).toBe(10);
    const extreme = perRow.peers.find((p) => p.ticker === "BBBB")!;
    expect(extreme.included).toBe(false);
    expect(extreme.excludeReason).toBe("outlier");
    expect(extreme.name).toBe("Pair extrême");
    expect(extreme.value).toBe(250);
  });
});
