import { describe, expect, it } from "vitest";
import { fixtureCompany, fixtureSeries, fixtureSheetInput } from "./__fixtures__";
import { buildFinancialYears, parseNgxProfileMeta } from "./fundamentals";
import { concludeAllPolicies, concludeForPolicy, type PolicyFacts } from "./policy";
import { priceStats } from "./price-stats";
import { buildNgxSheet } from "./sheet-model";
import { cleanNgxName, isFinancialGroup, ngxSectorGroup } from "./sectors";
import {
  bookValuePerShare,
  cagrPercent,
  dividendYearsPaid,
  dividendYieldPercent,
  earningsPerShare,
  estimateFairValues,
  grahamNumber,
  marketCapBn,
  median,
  payoutPercent,
  priceToBook,
  priceToEarnings,
  relativeGapPercent,
  returnOnEquityPercent,
  sectorStat,
  summarizeValuation,
} from "./valuation";

describe("ratios de base", () => {
  it("calcule BPA, PER, PBR, rendement, capitalisation", () => {
    expect(earningsPerShare(100, 1e9)).toBeCloseTo(100);
    expect(bookValuePerShare(500, 1e9)).toBeCloseTo(500);
    expect(priceToEarnings(1000, 100)).toBe(10);
    expect(priceToBook(1000, 500)).toBe(2);
    expect(dividendYieldPercent(50, 1000)).toBe(5);
    expect(payoutPercent(50, 100)).toBe(50);
    expect(marketCapBn(1000, 1e9)).toBe(1000);
    expect(returnOnEquityPercent(100, 500)).toBe(20);
  });

  it("refuse les ratios non significatifs", () => {
    expect(priceToEarnings(100, -5)).toBeNull();
    expect(priceToEarnings(100, 0)).toBeNull();
    expect(priceToBook(100, -1)).toBeNull();
    expect(payoutPercent(5, -2)).toBeNull();
    expect(earningsPerShare(10, 0)).toBeNull();
    expect(dividendYieldPercent(1, 0)).toBeNull();
    expect(returnOnEquityPercent(10, -3)).toBeNull();
    expect(marketCapBn(null, 1e9)).toBeNull();
  });

  it("CAGR et médiane", () => {
    expect(cagrPercent(100, 200, 5)).toBeCloseTo(14.87, 1);
    expect(cagrPercent(-10, 20, 3)).toBeNull();
    expect(cagrPercent(10, 20, 0)).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 10])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("médiane sectorielle", () => {
  it("signale une faible confiance sous 4 sociétés", () => {
    expect(sectorStat([10, 12, null, 14])).toEqual({
      median: 12,
      n: 3,
      lowConfidence: true,
    });
    const four = sectorStat([8, 10, 12, 20]);
    expect(four.n).toBe(4);
    expect(four.lowConfidence).toBe(false);
    expect(four.median).toBe(11);
  });
  it("écart relatif", () => {
    expect(relativeGapPercent(12, 10)).toBe(20);
    expect(relativeGapPercent(5, 0)).toBeNull();
    expect(relativeGapPercent(null, 10)).toBeNull();
  });
});

describe("valeur indicative", () => {
  it("nombre de Graham", () => {
    expect(grahamNumber(10, 90)).toBeCloseTo(Math.sqrt(22.5 * 10 * 90));
    expect(grahamNumber(-1, 90)).toBeNull();
  });
  it("estime et compare au cours", () => {
    const estimates = estimateFairValues({
      price: 100,
      eps: 10,
      bvps: 80,
      sectorPer: { median: 8, n: 5, lowConfidence: false },
      sectorPbr: { median: 1.5, n: 2, lowConfidence: true },
    });
    expect(estimates.map((e) => e.method)).toEqual(["SECTOR_PER", "SECTOR_PBR", "GRAHAM"]);
    expect(estimates[0].value).toBe(80);
    expect(estimates[0].priceGapPercent).toBeCloseTo(25);
    expect(estimates[1].lowConfidence).toBe(true);
    expect(summarizeValuation(100, estimates).verdict).toBe("WITHIN");
    expect(summarizeValuation(40, estimates).verdict).toBe("BELOW");
    expect(summarizeValuation(400, estimates).verdict).toBe("ABOVE");
  });
  it("renvoie UNKNOWN sans estimation", () => {
    const none = estimateFairValues({
      price: 100,
      eps: null,
      bvps: null,
      sectorPer: sectorStat([]),
      sectorPbr: sectorStat([]),
    });
    expect(none).toEqual([]);
    expect(summarizeValuation(100, none).verdict).toBe("UNKNOWN");
  });
  it("compte les dividendes versés", () => {
    const d = [2021, 2022, 2024, 2025].map((year) => ({ year, amount: 1 }));
    expect(dividendYearsPaid(d, 2025, 5)).toEqual({ paid: 4, window: 5 });
  });
});

describe("secteurs et noms", () => {
  it("sépare banques et assureurs de FINANCIAL SERVICES", () => {
    expect(ngxSectorGroup("GTCO", "financial-services")).toBe("BANKING");
    expect(ngxSectorGroup("AIICO", "FINANCIAL SERVICES")).toBe("INSURANCE");
    expect(ngxSectorGroup("UCAP", "financial-services")).toBe("OTHER");
    expect(ngxSectorGroup("DANGCEM", "INDUSTRIAL GOODS")).toBe("INDUSTRIAL_GOODS");
    expect(ngxSectorGroup("SEPLAT", "OIL AND GAS")).toBe("OIL_GAS");
    expect(ngxSectorGroup("GEREGU", "UTILITIES")).toBe("OTHER");
    expect(ngxSectorGroup("XYZ", "unknown")).toBe("OTHER");
    expect(isFinancialGroup("BANKING")).toBe(true);
    expect(isFinancialGroup("ICT")).toBe(false);
  });
  it("nettoie les suffixes techniques", () => {
    expect(cleanNgxName("ASSOCIATED BUS COMPANY PLC Security Name")).toBe("ASSOCIATED BUS COMPANY PLC");
    expect(cleanNgxName("ACCESSCORP [MRF]")).toBe("ACCESSCORP");
    expect(cleanNgxName("NESTLE NIGERIA PLC.")).toBe("NESTLE NIGERIA PLC.");
  });
});

describe("fondamentaux", () => {
  it("lit profile_meta de façon défensive", () => {
    expect(parseNgxProfileMeta(null).sharesOutstanding).toBeNull();
    expect(
      parseNgxProfileMeta({
        ngxFundamentals: { sharesOutstanding: { value: -3 } },
      }).sharesOutstanding,
    ).toBeNull();
    const m = parseNgxProfileMeta({
      ngxFundamentals: {
        sharesOutstanding: { value: "1 000", sourceUrl: "javascript:alert(1)" },
        years: {
          "2024": { equityBn: "12,5", epsNgn: 3 },
          abc: { equityBn: 1 },
        },
      },
    });
    expect(m.sharesOutstanding?.value).toBe(1000);
    expect(m.sharesOutstanding?.sourceUrl).toBeNull();
    expect(m.years[2024]).toMatchObject({ equityBn: 12.5, epsNgn: 3 });
    expect(Object.keys(m.years)).toEqual(["2024"]);
  });
  it("construit 10 exercices max, canonique d'abord, BPA publié sinon calculé", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      year: 2014 + i,
      revenue: 100 + i,
      operatingIncome: 10,
      netIncome: 5,
      isCanonical: true,
      source: "NGX_OFFICIEL",
    }));
    rows.push({
      year: 2025,
      revenue: 1,
      operatingIncome: 1,
      netIncome: 1,
      isCanonical: false,
      source: "MANUEL",
    });
    const meta = parseNgxProfileMeta({
      ngxFundamentals: {
        sharesOutstanding: { value: 1e9 },
        years: { "2025": { epsNgn: 9.9 } },
      },
    });
    const years = buildFinancialYears(rows, meta);
    expect(years).toHaveLength(10);
    expect(years[years.length - 1].year).toBe(2025);
    expect(years[years.length - 1].revenueBn).toBe(111);
    expect(years[years.length - 1].epsNgn).toBe(9.9);
    expect(years[years.length - 1].epsIsReported).toBe(true);
    expect(years[0].epsNgn).toBeCloseTo(5);
  });
});

describe("statistiques de cours", () => {
  it("calcule rendements, moyennes, volatilité et liquidité", () => {
    const s = priceStats(fixtureSeries(420, 100, 0.001, 1_000_000));
    expect(s.points).toBeGreaterThan(250);
    expect(s.sma50).not.toBeNull();
    expect(s.sma200).not.toBeNull();
    expect(s.return1yPercent).not.toBeNull();
    expect(s.volatilityPercent).toBeGreaterThan(0);
    expect(s.avgDailyValueNgn).toBeGreaterThan(50_000_000);
    expect(s.tradedSessionsRatio).toBe(1);
  });
  it("reste vide sans historique", () => {
    const s = priceStats([]);
    expect(s.lastClose).toBeNull();
    expect(s.sma50).toBeNull();
    expect(s.return1yPercent).toBeNull();
  });
});

function facts(over: Partial<PolicyFacts> = {}): PolicyFacts {
  return {
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
    price: priceStats([]),
    ...over,
  };
}

describe("conclusion par politique", () => {
  it("est « données insuffisantes » sans chiffres", () => {
    for (const c of concludeAllPolicies(facts())) expect(c.verdict).toBe("INSUFFICIENT");
  });
  it("juge favorable une croissance rentable et régulière", () => {
    const c = concludeForPolicy(
      "CROISSANCE",
      facts({
        revenueCagrPercent: 18,
        netIncomeCagrPercent: 22,
        latestNetIncomeBn: 100,
        roePercent: 20,
        profitableYears: 5,
        knownYears: 5,
        valuationVerdict: "BELOW",
      }),
    );
    expect(c.verdict).toBe("FAVORABLE");
    expect(c.okCount).toBe(5);
  });
  it("pénalise une société déficitaire", () => {
    const c = concludeForPolicy(
      "CROISSANCE",
      facts({
        revenueCagrPercent: -2,
        latestNetIncomeBn: -4,
        netIncomeCagrPercent: null,
        roePercent: -5,
        profitableYears: 1,
        knownYears: 5,
        valuationVerdict: "ABOVE",
      }),
    );
    expect(c.verdict).toBe("UNFAVORABLE");
    expect(c.criteria.find((x) => x.key === "earningsGrowth")?.status).toBe("KO");
  });
  it("rente : rendement, régularité et distribution", () => {
    const good = concludeForPolicy(
      "RENTE",
      facts({
        dividendYieldPercent: 9,
        dividendYearsPaid: 5,
        payoutPercent: 55,
        dividendGrowthPercent: 20,
        profitableYears: 5,
        knownYears: 5,
      }),
    );
    expect(good.verdict).toBe("FAVORABLE");
    const risky = concludeForPolicy(
      "RENTE",
      facts({
        dividendYieldPercent: 2,
        dividendYearsPaid: 1,
        payoutPercent: 130,
        dividendGrowthPercent: -50,
        profitableYears: 2,
        knownYears: 5,
      }),
    );
    expect(risky.verdict).toBe("UNFAVORABLE");
  });
  it("trading : s'appuie sur le graphique seul", () => {
    const up = concludeForPolicy("TRADING", facts({ price: priceStats(fixtureSeries(420, 100, 0.002, 5_000_000)) }));
    expect(up.criteria.find((x) => x.key === "trend")?.status).toBe("OK");
    expect(up.evaluated).toBeGreaterThanOrEqual(3);
  });
});

describe("modèle de la fiche", () => {
  const model = buildNgxSheet(fixtureSheetInput());

  it("calcule les multiples dans l'application", () => {
    expect(model.tier).toBe("FULL");
    const m = model.price.metrics;
    expect(m.eps).toBeCloseTo((118 * 1e9) / 1.7e9, 4);
    expect(m.per).toBeCloseTo(420 / m.eps!, 4);
    expect(m.pbr).toBeCloseTo(420 / ((520 * 1e9) / 1.7e9), 4);
    expect(model.presentation.marketCapBn).toBeCloseTo((420 * 1.7e9) / 1e9, 4);
    expect(model.presentation.marketCapRank).toBeGreaterThan(0);
  });
  it("médiane sectorielle sur les pairs (soi-même exclu)", () => {
    const per = model.sectorComparison.rows.find((r) => r.key === "per")!;
    expect(per.stat.n).toBe(4);
    expect(per.stat.lowConfidence).toBe(false);
    expect(per.gapPercent).not.toBeNull();
    expect(model.valuation.estimates.length).toBe(3);
  });
  it("sépare événements, orientations et documents", () => {
    expect(model.outlook.guidance).toHaveLength(1);
    expect(model.outlook.upcoming.map((e) => e.eventType)).toEqual(["AGM"]);
    expect(model.outlook.past.map((e) => e.eventType)).toEqual(["RESULTS"]);
    expect(model.performance.documents[0].periodLabel).toBe("2025");
  });
  it("dividendes : une ligne par exercice, rendement courant", () => {
    expect(model.dividends.lines[0].year).toBe(2025);
    expect(model.dividends.currentDps).toBe(32);
    expect(model.dividends.currentYieldPercent).toBeCloseTo((32 / 420) * 100, 4);
    expect(model.dividends.yearsPaid).toEqual({ paid: 5, window: 5 });
    expect(model.policies).toHaveLength(4);
  });
  it("sans comptes : état « à venir », seule la lecture graphique reste", () => {
    const input = fixtureSheetInput();
    const bare = fixtureCompany("SMALLCO", 5, { shares: null });
    const m = buildNgxSheet({
      ...input,
      company: bare,
      universe: [bare],
      events: [],
      documents: [],
    });
    expect(m.tier).toBe("COMING_SOON");
    expect(m.performance.years).toEqual([]);
    expect(m.price.metrics.per).toBeNull();
    expect(m.valuation.summary.verdict).toBe("UNKNOWN");
    expect(m.policies.map((p) => p.type)).toEqual(["TRADING"]);
    expect(m.sectorComparison.lowConfidence).toBe(true);
  });
});
