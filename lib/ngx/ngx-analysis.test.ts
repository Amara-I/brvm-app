import { describe, expect, it } from "vitest";
import { fixtureCompany, fixtureSeries, fixtureSheetInput } from "./__fixtures__";
import { buildFinancialYears, parseNgxProfileMeta, type NgxFinancialYear } from "./fundamentals";
import { concludeAllPolicies, concludeForPolicy, type PolicyFacts } from "./policy";
import { priceStats } from "./price-stats";
import { buildNgxSheet, computeCompanyMetrics, currentDividend } from "./sheet-model";
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
  priceToBookFromCap,
  priceToEarnings,
  priceToEarningsFromCap,
  relativeGapPercent,
  returnOnEquityPercent,
  sectorStat,
  selectEquityBasis,
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
    expect(dividendYearsPaid(d, 2025, 5)).toEqual({ paid: 4, window: 5, known: 4 });
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
  it("construit 10 exercices max, canonique d'abord, BPA publié uniquement", () => {
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
    // Jamais de BPA déduit du nombre de titres actuel pour un exercice passé.
    expect(years[0].epsNgn).toBeNull();
    expect(years[0].eraShares).toBeNull();
    // Titres de l'exercice = résultat net ÷ BPA publié (5 Mds de ₦ ÷ 9,9 ₦).
    expect(years[years.length - 1].eraShares).toBeCloseTo(5e9 / 9.9, 0);
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
    // Capitalisation actuelle = 714 Mds ₦ ; PER = capitalisation ÷ résultat net, PBR = capitalisation ÷ capitaux propres.
    expect(model.presentation.marketCapBn).toBeCloseTo((420 * 1.7e9) / 1e9, 4);
    expect(m.eps).toBeNull(); // aucun BPA publié : rien n'est déduit du nombre de titres actuel
    expect(m.per).toBeCloseTo(714 / 118, 4);
    expect(m.perYear).toBe(2025);
    expect(m.pbr).toBeCloseTo(714 / 520, 4);
    expect(m.pbrStatus).toBe("ok");
    expect(m.equityYear).toBe(2025);
    expect(m.bvps).toBeNull(); // titres de l'exercice inconnus (pas de BPA publié) : actif net par action masqué
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
    expect(model.dividends.yearsPaid).toEqual({ paid: 5, window: 5, known: 5 });
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

// ───────────── Dividende / CA manquants : N/D, jamais 0 ─────────────

function sheetFor(company: ReturnType<typeof fixtureCompany>, peers: ReturnType<typeof fixtureCompany>[] = []) {
  const input = fixtureSheetInput();
  return buildNgxSheet({ ...input, company, universe: [company, ...peers], events: [], documents: [] });
}

/** Société avec comptes jusqu'en 2025 ; `dps` aligné sur 2025 (dernier élément) puis filtré par année. */
function companyWithDps(ticker: string, dps: Array<[number, number]>, over: { revenue?: number[] } = {}) {
  const base = fixtureCompany(ticker, 100, {
    netIncome: [10, 11, 12, 13, 14],
    revenue: over.revenue ?? [100, 110, 120, 130, 140],
    equity: 80,
    shares: 1e9,
    sector: "BANKING",
    sectorSlug: "banking",
  });
  return {
    ...base,
    dividends: dps.map(([year, amount]) => ({
      year,
      amount,
      exDate: null,
      paymentDate: null,
      isCanonical: true,
      source: "NGX_OFFICIEL",
    })),
  };
}

describe("dividende non confirmé (N/D, jamais 0)", () => {
  it("currentDividend : ligne récente = valeur, ligne ancienne = null, aucune ligne = NONE", () => {
    expect(currentDividend([], 2025)).toEqual({ dps: null, year: null, status: "NONE" });
    expect(currentDividend([{ year: 2025, dps: 3 }], 2025)).toEqual({ dps: 3, year: 2025, status: "CONFIRMED" });
    expect(currentDividend([{ year: 2024, dps: 3 }], 2025)).toEqual({ dps: 3, year: 2024, status: "CONFIRMED" });
    expect(currentDividend([{ year: 2022, dps: 3 }], 2025)).toEqual({ dps: null, year: 2022, status: "UNCONFIRMED" });
  });

  it("comptes 2025 mais DPS arrêté en 2022 : N/D, pas 0 ₦ ni 0 %", () => {
    const co = companyWithDps("OLDDIV", [
      [2020, 2],
      [2021, 2.5],
      [2022, 3],
    ]);
    const m = sheetFor(co);
    expect(m.dividends.currentStatus).toBe("UNCONFIRMED");
    expect(m.dividends.currentDps).toBeNull();
    expect(m.dividends.currentYieldPercent).toBeNull();
    expect(m.dividends.currentDpsYear).toBe(2022);
    expect(m.dividends.growthPercent).toBeNull();
    expect(m.dividends.missingYears.map((x) => x.year)).toEqual([2025, 2024, 2023]);
    expect(computeCompanyMetrics(co).yieldPercent).toBeNull();
  });

  it("DPS à 0 enregistré pour l'exercice : 0 ₦ / 0 % explicite", () => {
    const co = companyWithDps("NODIV", [
      [2024, 2],
      [2025, 0],
    ]);
    const m = sheetFor(co);
    expect(m.dividends.currentStatus).toBe("CONFIRMED");
    expect(m.dividends.currentDps).toBe(0);
    expect(m.dividends.currentYieldPercent).toBe(0);
    expect(m.dividends.missingYears).toEqual([]);
  });

  it("dernier DPS = exercice précédent : valeur affichée, exercice courant listé en N/D", () => {
    const m = sheetFor(companyWithDps("PREV", [[2024, 4]]));
    expect(m.dividends.currentDps).toBe(4);
    expect(m.dividends.currentDpsYear).toBe(2024);
    expect(m.dividends.lastFiscalYear).toBe(2025);
    expect(m.dividends.missingYears.map((x) => x.year)).toEqual([2025]);
  });

  it("exercices sans ligne DPS ne comptent pas comme « sans dividende »", () => {
    const m = sheetFor(
      companyWithDps("PARTIAL", [
        [2021, 1],
        [2022, 1],
      ]),
    );
    expect(m.dividends.yearsPaid).toEqual({ paid: 2, window: 5, known: 2 });
    // Rente : régularité N/D (historique incomplet, 2 < 4), rendement/distribution N/D → pas de verdict
    const rente = m.policies.find((p) => p.type === "RENTE")!;
    const status = (k: string) => rente.criteria.find((c) => c.key === k)?.status;
    expect(status("dividendYield")).toBe("ND");
    expect(status("dividendRegularity")).toBe("ND");
    expect(status("payout")).toBe("ND");
    expect(status("dividendGrowth")).toBe("ND");
    expect(rente.verdict).toBe("INSUFFICIENT");
  });

  it("une dernière ligne à 0 mais ancienne n'est pas non plus lue comme « 0 »", () => {
    const m = sheetFor(companyWithDps("OLDZERO", [[2021, 0]]));
    expect(m.dividends.currentDps).toBeNull();
    expect(m.dividends.currentYieldPercent).toBeNull();
  });

  it("médiane sectorielle du rendement : les pairs sans DPS confirmé sont exclus, pas comptés à 0", () => {
    const peerA = companyWithDps("PA", [[2025, 5]]); // 5 %
    const peerB = companyWithDps("PB", [[2025, 3]]); // 3 %
    const peerC = companyWithDps("PC", [[2021, 9]]); // non confirmé
    const peerD = companyWithDps("PD", []); // aucune ligne
    const self = companyWithDps("ME", [[2025, 4]]);
    const m = sheetFor(self, [peerA, peerB, peerC, peerD]);
    const row = m.sectorComparison.rows.find((r) => r.key === "yield")!;
    expect(row.stat.n).toBe(2);
    expect(row.stat.median).toBeCloseTo(4, 6);
  });

  it("policy : un facts sans rendement/régularité ne note pas la rente à 0", () => {
    const base = {
      dividendYearsPaid: 2,
      dividendYearsKnown: 2,
      dividendWindow: 5,
      profitableYears: 5,
      knownYears: 5,
    };
    const r = concludeForPolicy("RENTE", facts({ ...base }));
    expect(r.criteria.find((c) => c.key === "dividendRegularity")?.status).toBe("ND");
    // un minimum déjà ≥ 4 suffit à prouver la régularité même si l'historique est incomplet
    const ok = concludeForPolicy("RENTE", facts({ ...base, dividendYearsPaid: 4, dividendYearsKnown: 4 }));
    expect(ok.criteria.find((c) => c.key === "dividendRegularity")?.status).toBe("OK");
    // historique complet à 2 sur 5 : bien évalué, et défavorable
    const full = concludeForPolicy("RENTE", facts({ ...base, dividendYearsKnown: 5 }));
    expect(full.criteria.find((c) => c.key === "dividendRegularity")?.status).toBe("NEUTRAL");
  });
});

describe("CA / marge manquants : dernier exercice avec données, étiqueté de son année", () => {
  it("2025 sans CA : croissance et marge nette reprennent 2024", () => {
    const m = sheetFor(companyWithDps("NOREV", [[2025, 1]], { revenue: [100, 110, 120, 130] }));
    expect(m.performance.latestYear).toBe(2025);
    expect(m.performance.latestRevenueGrowthYear).toBe(2024);
    expect(m.performance.latestRevenueGrowthPercent).toBeCloseTo((130 / 120 - 1) * 100, 6);
    expect(m.performance.latestNetMarginYear).toBe(2024);
    expect(m.performance.latestNetMarginPercent).toBeCloseTo((13 / 130) * 100, 6);
    expect(m.performance.latestOperatingMarginYear).toBe(2024);
  });

  it("dernier exercice complet : année = dernier exercice", () => {
    const m = sheetFor(companyWithDps("FULLREV", [[2025, 1]]));
    expect(m.performance.latestRevenueGrowthYear).toBe(2025);
    expect(m.performance.latestNetMarginYear).toBe(2025);
    expect(m.performance.latestNetMarginPercent).toBeCloseTo((14 / 140) * 100, 6);
  });

  it("aucun CA connu : N/D (null), pas de valeur inventée", () => {
    const m = sheetFor(companyWithDps("NOREVAT", [[2025, 1]], { revenue: [] }));
    expect(m.performance.latestRevenueGrowthPercent).toBeNull();
    expect(m.performance.latestRevenueGrowthYear).toBeNull();
    expect(m.performance.latestNetMarginPercent).toBeNull();
    expect(m.performance.latestNetMarginYear).toBeNull();
  });
});

describe("multiples par capitalisation", () => {
  it("PBR : n/s si capitaux propres ≤ 0, PBR > 12× ou capitaux propres < 2 % de la capitalisation", () => {
    expect(priceToBookFromCap(900, 450)).toEqual({ value: 2, status: "ok" });
    expect(priceToBookFromCap(900, 75)).toEqual({ value: 12, status: "ok" });
    expect(priceToBookFromCap(900, 70).status).toBe("not_significant");
    expect(priceToBookFromCap(900, 10).status).toBe("not_significant");
    expect(priceToBookFromCap(900, 0).status).toBe("negative");
    expect(priceToBookFromCap(900, -458).status).toBe("negative");
    expect(priceToBookFromCap(null, 100).status).toBe("unavailable");
    expect(priceToBookFromCap(900, null).status).toBe("unavailable");
  });
  it("PER = capitalisation ÷ résultat net ; négatif = non significatif", () => {
    expect(priceToEarningsFromCap(900, 90)).toEqual({ value: 10, status: "ok" });
    expect(priceToEarningsFromCap(900, -5)).toEqual({ value: null, status: "negative" });
    expect(priceToEarningsFromCap(900, null).status).toBe("unavailable");
  });
});

describe("capitaux propres confirmés", () => {
  const yr = (year: number, equityBn: number | null, equityConfidence: NgxFinancialYear["equityConfidence"] = null) =>
    ({
      year,
      revenueBn: null,
      operatingIncomeBn: null,
      netIncomeBn: null,
      equityBn,
      equityConfidence,
      epsNgn: null,
      eraShares: null,
      sourceUrl: null,
    }) satisfies NgxFinancialYear;

  it("confiance enregistrée : seul « high » est confirmé", () => {
    const sel = selectEquityBasis([yr(2023, 100, "high"), yr(2024, 110, "medium"), yr(2025, 120, "high")]);
    expect(sel.basis?.year).toBe(2025);
    expect(sel.unconfirmedLatest).toBeNull();
    const sel2 = selectEquityBasis([yr(2023, 100, "high"), yr(2024, 110, "high"), yr(2025, 120, "medium")]);
    expect(sel2.basis?.year).toBe(2024);
    expect(sel2.unconfirmedLatest?.year).toBe(2025);
  });
  it("sans confiance enregistrée : le dernier exercice de la série n'est jamais confirmé", () => {
    const sel = selectEquityBasis([yr(2024, 100), yr(2025, 120)]);
    expect(sel.basis?.year).toBe(2024);
    expect(sel.unconfirmedLatest?.year).toBe(2025);
    const solo = selectEquityBasis([yr(2025, 120)]);
    expect(solo.basis).toBeNull();
    expect(solo.unconfirmedLatest?.year).toBe(2025);
  });
  it("lit les confiances stockées et ignore les valeurs inconnues", () => {
    const m = parseNgxProfileMeta({
      ngxFundamentals: {
        years: { "2024": { equityBn: 1, equityConfidence: "high", epsNgn: 2, epsConfidence: "bogus" } },
      },
    });
    expect(m.years[2024].equityConfidence).toBe("high");
    expect(m.years[2024].epsConfidence).toBeNull();
  });
});

describe("ratios de valorisation corrigés (cas réels simplifiés)", () => {
  it("augmentation de capital : PBR par capitalisation, actif net par action avec les titres de l'exercice", () => {
    // 3×10¹⁰ titres aujourd'hui, mais 10¹⁰ dans les comptes (résultat 12 Mds ÷ BPA 1,2 ₦).
    const c = fixtureCompany("ISSUE", 30, {
      shares: 3e10,
      netIncome: [10, 12],
      epsByYear: { 2024: 1, 2025: 1.2 },
      equityByYear: { 2024: 100, 2025: 110 },
      equityConfidence: null,
    });
    const m = computeCompanyMetrics(c);
    expect(m.marketCapBn).toBeCloseTo(900);
    expect(m.eps).toBe(1.2); // publié, jamais résultat ÷ titres actuels (0,4)
    expect(m.per).toBeCloseTo(900 / 12);
    expect(m.pbr).toBeCloseTo(9);
    expect(m.equityYear).toBe(2024);
    expect(m.equityUnconfirmed).toEqual({ year: 2025, equityBn: 110 });
    expect(m.bvps).toBeCloseTo(10); // 100 Mds ÷ 10¹⁰ titres ; l'ancien calcul donnait 110 ÷ 3×10¹⁰ = 3,67 ₦
    expect(m.bvpsYear).toBe(2024);
    expect(m.roePercent).toBeCloseTo(10); // résultat 2024 ÷ capitaux propres 2024
    expect(m.roeYear).toBe(2024);
  });
  it("capitaux propres négatifs : PBR, ROE et actif net masqués", () => {
    const c = fixtureCompany("NEGEQ", 100, {
      shares: 1e9,
      netIncome: [5, 8],
      epsByYear: { 2025: 8 },
      equityByYear: { 2025: -50 },
    });
    const m = computeCompanyMetrics(c);
    expect(m.pbr).toBeNull();
    expect(m.pbrStatus).toBe("negative");
    expect(m.bvps).toBeNull();
    expect(m.roePercent).toBeNull();
    expect(m.per).toBeCloseTo(100 / 8);
  });
  it("PBR > 12× ou capitaux propres < 2 % de la capitalisation : n/s", () => {
    const high = computeCompanyMetrics(
      fixtureCompany("PBRHIGH", 100, { shares: 1e9, netIncome: [8], equityByYear: { 2025: 5 } }),
    );
    expect(high.pbrStatus).toBe("not_significant");
    expect(high.pbr).toBeNull();
    const tiny = computeCompanyMetrics(
      fixtureCompany("PBRTINY", 100, { shares: 1e9, netIncome: [8], equityByYear: { 2025: 1.5 } }),
    );
    expect(tiny.pbrStatus).toBe("not_significant");
    expect(tiny.roePercent).toBeNull(); // 8 ÷ 1,5 : ROE sans signification quand les capitaux propres sont < 2 % de la capitalisation
  });
  it("MTNN : 2024 négatif confirmé, 2025 positif non confirmé → capitaux propres négatifs, 2025 signalé", () => {
    const c = fixtureCompany("MTNLIKE", 825, {
      shares: 2.1e10,
      netIncome: [-730, 1100],
      epsByYear: { 2025: 53 },
      equityByYear: { 2024: -458, 2025: 548.7 },
      equityConfidence: null,
    });
    const m = computeCompanyMetrics(c);
    expect(m.equityYear).toBe(2024);
    expect(m.pbrStatus).toBe("negative");
    expect(m.pbr).toBeNull();
    expect(m.roePercent).toBeNull();
    expect(m.equityUnconfirmed).toEqual({ year: 2025, equityBn: 548.7 });
  });
  it("tous les exercices en confiance moyenne : aucun PBR ni ROE, l'exercice est signalé non confirmé", () => {
    const c = fixtureCompany("MEDONLY", 100, {
      shares: 1e9,
      netIncome: [8],
      equityByYear: { 2025: 80 },
      equityConfidence: "medium",
    });
    const m = computeCompanyMetrics(c);
    expect(m.pbrStatus).toBe("unavailable");
    expect(m.equityYear).toBeNull();
    expect(m.roePercent).toBeNull();
    expect(m.equityUnconfirmed).toEqual({ year: 2025, equityBn: 80 });
  });
  it("dividende : taux de distribution uniquement avec le BPA publié de l'exercice", () => {
    const withEps = fixtureCompany("PAYOUT", 100, {
      shares: 1e9,
      netIncome: [8],
      epsByYear: { 2025: 8 },
      equityByYear: { 2025: 80 },
      dps: [4],
    });
    const without = fixtureCompany("NOEPS", 100, { shares: 1e9, netIncome: [8], equityByYear: { 2025: 80 }, dps: [4] });
    const inputOf = (company: ReturnType<typeof fixtureCompany>) => ({
      ...fixtureSheetInput(),
      company,
      universe: [company],
    });
    expect(buildNgxSheet(inputOf(withEps)).dividends.lines[0].payoutPercent).toBeCloseTo(50);
    expect(buildNgxSheet(inputOf(without)).dividends.lines[0].payoutPercent).toBeNull();
  });
  it("médianes sectorielles : valeurs n/s et capitaux propres négatifs exclus, valeur indicative sans PBR", () => {
    const input = fixtureSheetInput();
    const mk = (ticker: string, equity: number) =>
      fixtureCompany(ticker, 100, {
        shares: 1e9,
        netIncome: [8],
        equityByYear: { 2025: equity },
        sector: "INDUSTRIAL GOODS",
        sectorSlug: "industrial-goods",
      });
    const peers = [mk("P1", 80), mk("P2", 60), mk("P3", 90), mk("P4", 70), mk("NEG", -10), mk("TINY", 2)];
    const sub = fixtureCompany("SUBJECT", 100, {
      shares: 1e9,
      netIncome: [8],
      equityByYear: { 2025: -30 },
      sector: "INDUSTRIAL GOODS",
      sectorSlug: "industrial-goods",
    });
    const m = buildNgxSheet({ ...input, company: sub, universe: [sub, ...peers] });
    const pbr = m.sectorComparison.rows.find((r) => r.key === "pbr")!;
    const per = m.sectorComparison.rows.find((r) => r.key === "per")!;
    expect(per.stat.n).toBe(6); // PER = 100 ÷ 8 = 12,5 pour les six pairs
    expect(pbr.stat.n).toBe(4); // NEG (négatif) et TINY (n/s) exclus
    expect(pbr.stat.median).toBeCloseTo((100 / 80 + 100 / 70) / 2); // pairs retenus : 1,25 / 1,67 / 1,11 / 1,43
    expect(pbr.company).toBeNull();
    expect(pbr.companyStatus).toBe("negative");
    expect(m.valuation.estimates.map((e) => e.method)).toEqual(["SECTOR_PER"]);
  });

  describe("comptes trop anciens", () => {
    const ending = (ticker: string, lastYear: number) => {
      const c = fixtureCompany(ticker, 100, {
        shares: 1e9,
        netIncome: [6, 8],
        revenue: [60, 80],
        equityByYear: { [lastYear - 1]: 80, [lastYear]: 90 },
        epsByYear: { [lastYear]: 0.8 },
        sector: "INDUSTRIAL GOODS",
        sectorSlug: "industrial-goods",
      });
      const shift = lastYear - 2025;
      return { ...c, ratios: c.ratios.map((r) => ({ ...r, year: r.year + shift })) };
    };
    it("dernier exercice > 2 ans : PER, PBR et ROE n/s, rien pour la valorisation", () => {
      const m = computeCompanyMetrics(ending("OLD", 2022), "2026-10-28");
      expect(m.staleAccountsYear).toBe(2022);
      expect([m.per, m.pbr, m.roePercent, m.impliedEps, m.impliedBvps]).toEqual([null, null, null, null, null]);
      expect(m.perStatus).toBe("stale");
      expect(m.pbrStatus).toBe("stale");
      expect(m.marketCapBn).toBeCloseTo(100); // la capitalisation reste affichée
    });
    it("2 ans d'écart au plus : ratios calculés ; sans date : pas de test d'ancienneté", () => {
      const ok = computeCompanyMetrics(ending("OK", 2024), "2026-10-28");
      expect(ok.staleAccountsYear).toBeNull();
      expect(ok.per).toBeCloseTo(100 / 8);
      expect(ok.pbr).toBeCloseTo(100 / 90);
      expect(computeCompanyMetrics(ending("OLD", 2022)).staleAccountsYear).toBeNull();
      expect(computeCompanyMetrics(ending("EDGE", 2023), "2026-01-02").staleAccountsYear).toBe(2023);
    });
    it("exclu des médianes sectorielles et de la valorisation", () => {
      const input = fixtureSheetInput();
      const peers = [ending("P1", 2025), ending("P2", 2025), ending("STALE", 2022)];
      const subject = ending("SUBJECT", 2022);
      const m = buildNgxSheet({ ...input, company: subject, universe: [subject, ...peers] });
      const per = m.sectorComparison.rows.find((r) => r.key === "per")!;
      const roe = m.sectorComparison.rows.find((r) => r.key === "roe")!;
      expect(per.stat.n).toBe(2); // le pair STALE est exclu
      expect(per.company).toBeNull();
      expect(per.companyStatus).toBe("stale");
      expect(roe.companyStatus).toBe("stale");
      expect(m.valuation.estimates).toEqual([]);
      expect(m.valuation.summary.verdict).toBe("UNKNOWN");
    });
  });
});
