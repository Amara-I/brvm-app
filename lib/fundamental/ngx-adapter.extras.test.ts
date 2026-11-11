import { describe, expect, it } from "vitest";
import { fixtureCompany, fixtureSheetInput } from "@/lib/ngx/__fixtures__";
import { buildFinancialYears, parseNgxProfileMeta } from "@/lib/ngx/fundamentals";
import { buildNgxSheet, computeCompanyMetrics } from "@/lib/ngx/sheet-model";
import { historicalPer, ngxFundamentalInput } from "./ngx-adapter";

type Meta = { ngxFundamentals: Record<string, unknown> & { years: Record<string, Record<string, unknown>> } };

function usd(c: ReturnType<typeof fixtureCompany>, fx: number | null) {
  const m = structuredClone(c.profileMeta) as Meta;
  m.ngxFundamentals.reportingCurrency = "USD";
  if (fx != null) m.ngxFundamentals.fx = { ngnPerUsd: fx, asOf: "2026-11-11", sourceUrl: "https://www.cbn.gov.ng/rates/ExchRateByCurrency.html" };
  return { ...c, profileMeta: m };
}

describe("NGX — dette, FCF et PER historique", () => {
  it("lit fcf et debt_ratio des lignes de comptes", () => {
    const years = buildFinancialYears(
      [{ year: 2024, revenue: 100, operatingIncome: 20, netIncome: 10, fcf: 7.5, debtRatio: 42, isCanonical: true, source: "NGX_OFFICIEL" }],
      parseNgxProfileMeta(null),
    );
    expect(years[0].fcfBn).toBe(7.5);
    expect(years[0].debtRatioPercent).toBe(42);
  });

  it("PER historique = clôture brute de fin d'exercice ÷ BPA publié ; N/D si BPA ≤ 0 ou peu fiable", () => {
    const base = { year: 2024, revenueBn: 1, operatingIncomeBn: 1, netIncomeBn: 1, equityBn: 1, equityConfidence: null, eraShares: null, sourceUrl: null };
    expect(historicalPer({ ...base, epsNgn: 2, epsConfidence: "high" }, 20)).toBeCloseTo(10);
    expect(historicalPer({ ...base, epsNgn: -2, epsConfidence: "high" }, 20)).toBeNull();
    expect(historicalPer({ ...base, epsNgn: 2, epsConfidence: "low" }, 20)).toBeNull();
    expect(historicalPer({ ...base, epsNgn: 2, epsConfidence: "high" }, undefined)).toBeNull();
    // USD : BPA converti au taux CBN de clôture de l'exercice.
    expect(historicalPer({ ...base, epsNgn: 0.01, epsConfidence: "high", currency: "USD", ngnPerUsd: 1500 }, 30)).toBeCloseTo(2);
    expect(historicalPer({ ...base, epsNgn: 0.01, epsConfidence: "high", currency: "USD", ngnPerUsd: null }, 30)).toBeNull();
  });

  it("l'analyse fondamentale reçoit le PER historique, la dette et le FCF du dernier exercice", () => {
    const input = fixtureSheetInput();
    const last = Math.max(...input.company.ratios.map((r) => r.year));
    input.company = {
      ...input.company,
      ratios: input.company.ratios.map((r) => (r.year === last ? { ...r, fcf: 3.2, debtRatio: 55 } : r)),
    };
    const model = buildNgxSheet(input);
    const prices: Record<number, number> = {};
    for (const y of model.performance.years) prices[y.year] = 100;
    const fi = ngxFundamentalInput({ company: input.company, model, universe: input.universe, series: input.series, today: input.today, rawYearEndPrices: prices });
    expect(fi.debtRatio).toBe(55);
    expect(fi.fcf).toBe(3.2);
    const withEps = model.performance.years.filter((y) => (y.epsNgn ?? 0) > 0 && y.epsConfidence !== "low");
    for (const y of withEps) {
      const h = fi.ratioHistory!.find((r) => r.year === y.year);
      const expected = 100 / y.epsNgn!;
      if (expected <= 200) expect(h?.per).toBeCloseTo(expected);
    }
  });
});

describe("NGX — comptes publiés en USD", () => {
  const base = fixtureCompany("USDCO", 30, {
    shares: 1e9,
    netIncome: [0.2, 0.3],
    revenue: [2, 2.5],
    epsByYear: { 2024: 0.2, 2025: 0.3 },
    equityByYear: { 2024: 1.5, 2025: 2 },
  });

  it("convertit résultat, BPA et capitaux propres au taux CBN pour les multiples", () => {
    const m = computeCompanyMetrics(usd(base, 1500));
    const ngn = computeCompanyMetrics(base);
    expect(m.marketCapBn).toBeCloseTo(30);
    expect(m.per).toBeCloseTo(30 / (0.3 * 1500));
    expect(m.eps).toBeCloseTo(0.3 * 1500);
    expect(m.equityBn).toBeCloseTo(2 * 1500);
    // Ratios sans le cours inchangés par la devise.
    expect(m.netMarginPercent).toBeCloseTo(ngn.netMarginPercent!);
    expect(m.roePercent).toBeCloseTo(ngn.roePercent!);
  });

  it("sans taux enregistré : PER et PBR N/D (jamais un dollar lu comme un naira)", () => {
    const m = computeCompanyMetrics(usd(base, null));
    expect(m.per).toBeNull();
    expect(m.pbr).toBeNull();
    expect(m.eps).toBeNull();
  });

  it("la fiche signale la devise et l'onglet fondamental reçoit des montants en ₦", () => {
    const input = fixtureSheetInput();
    const company = usd(base, 1500);
    const model = buildNgxSheet({ ...input, company, universe: [...input.universe.filter((c) => c.ticker !== input.company.ticker), company] });
    expect(model.presentation.reportingCurrency).toEqual({
      currency: "USD",
      ngnPerUsd: 1500,
      asOf: "2026-11-11",
      sourceUrl: "https://www.cbn.gov.ng/rates/ExchRateByCurrency.html",
    });
    const fi = ngxFundamentalInput({ company, model, universe: [company], series: input.series, today: input.today });
    expect(fi.income.at(-1)?.revenue).toBeCloseTo(2.5 * 1500);
    expect(model.performance.years.at(-1)?.revenueBn).toBe(2.5);
  });
});

describe("dette et FCF : dernière valeur disponible avec son exercice", () => {
  it("latestKnown prend la valeur fournie, sinon le dernier exercice de l'historique", async () => {
    const { latestKnown } = await import("./brvm-analysis");
    const h = [
      { year: 2023, per: null, pbRatio: null, roe: null, netMargin: null, debtRatio: 40, revenueGrowth: null, fcf: 5 },
      { year: 2024, per: null, pbRatio: null, roe: null, netMargin: null, debtRatio: null, revenueGrowth: null, fcf: 7 },
    ];
    expect(latestKnown(null, null, h, (r) => r.debtRatio)).toEqual({ value: 40, year: 2023 });
    expect(latestKnown(null, null, h, (r) => r.fcf)).toEqual({ value: 7, year: 2024 });
    expect(latestKnown(12, 2025, h, (r) => r.fcf)).toEqual({ value: 12, year: 2025 });
    expect(latestKnown(5, null, h, (r) => r.fcf)).toEqual({ value: 5, year: 2023 });
    expect(latestKnown(null, null, [], (r) => r.fcf)).toBeNull();
  });

  it("NGX : FCF d'un exercice antérieur affiché avec son année, et colonne FCF par exercice", async () => {
    const { buildNgxFundamentalAnalysis } = await import("./ngx-adapter");
    const input = fixtureSheetInput();
    const years = [...new Set(input.company.ratios.map((r) => r.year))].sort();
    const prev = years[years.length - 2];
    input.company = {
      ...input.company,
      ratios: input.company.ratios.map((r) => (r.year === prev ? { ...r, fcf: 4.5, debtRatio: 30 } : r)),
    };
    const model = buildNgxSheet(input);
    const a = buildNgxFundamentalAnalysis({ company: input.company, model, universe: input.universe, series: input.series, today: input.today });
    expect(a.price.fcfBn).toBe(4.5);
    expect(a.price.fcfYear).toBe(prev);
    expect(a.price.debtRatio).toBe(30);
    expect(a.price.debtRatioYear).toBe(prev);
    expect(a.performance.debtRatioYear).toBe(prev);
    expect(a.performance.years.find((y) => y.year === prev)?.fcf).toBe(4.5);
  });
});
