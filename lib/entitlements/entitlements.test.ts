import { describe, expect, it } from "vitest";
import { FEATURE_MIN_PLAN, planAllows } from "./features";
import { capChartQueryForVisitor, isLockedChartRange } from "./chart-cap";
import { enforceAnonGates, isAnonChartRangeAllowed } from "./plans";
import { lastPositiveYear, slimCompanyForVisitor, presentCompaniesFullDataset, presentNgxBoardRows, presentDividendCalendar } from "./present";
import { can, viewerFromSession } from "./viewer";
import type { CompanyFullDataset } from "@/lib/api/companies-full-dataset";
import type { NgxBoardRow } from "@/lib/markets/ngx-board-row";

describe("enforceAnonGates", () => {
  it("est actif par défaut (env absent ou vide)", () => {
    expect(enforceAnonGates(undefined)).toBe(true);
    expect(enforceAnonGates("")).toBe(true);
    expect(enforceAnonGates("  ")).toBe(true);
  });

  it("se désactive avec 0 / false / off / no", () => {
    expect(enforceAnonGates("0")).toBe(false);
    expect(enforceAnonGates("false")).toBe(false);
    expect(enforceAnonGates("OFF")).toBe(false);
    expect(enforceAnonGates("No")).toBe(false);
  });

  it("reste actif pour toute autre valeur", () => {
    expect(enforceAnonGates("1")).toBe(true);
    expect(enforceAnonGates("true")).toBe(true);
  });
});

describe("viewerFromSession", () => {
  it("restreint le visiteur quand le drapeau est actif", () => {
    const v = viewerFromSession(null, true);
    expect(v.gated).toBe(true);
    expect(v.accessPlan).toBe("ANON");
    expect(can(v, "export.marketExcel")).toBe(false);
    expect(can(v, "chart.range.MAX")).toBe(false);
    expect(can(v, "chart.range.5A")).toBe(true);
    expect(can(v, "fundamental.teaser")).toBe(true);
  });

  it("donne un accès complet à tout compte connecté, y compris l'historique MAX", () => {
    const v = viewerFromSession("user-1", true);
    expect(v.gated).toBe(false);
    expect(v.accessPlan).toBe("PREMIUM");
    expect(can(v, "chart.range.MAX")).toBe(true);
    expect(can(v, "export.marketExcel")).toBe(true);
    expect(can(v, "signal.scenarios")).toBe(true);
  });

  it("lève les restrictions visiteur si le drapeau est désactivé", () => {
    const v = viewerFromSession(null, false);
    expect(v.gated).toBe(false);
    expect(v.accessPlan).toBe("PREMIUM");
    expect(can(v, "chart.range.MAX")).toBe(true);
  });
});

describe("FEATURE_MIN_PLAN", () => {
  it("réserve les scénarios et l'export au palier premium (contrat futur)", () => {
    expect(FEATURE_MIN_PLAN["signal.scenarios"]).toBe("PREMIUM");
    expect(FEATURE_MIN_PLAN["export.marketExcel"]).toBe("PREMIUM");
    expect(FEATURE_MIN_PLAN["chart.range.5A"]).toBe("ANON");
    expect(FEATURE_MIN_PLAN["chart.range.MAX"]).toBe("PREMIUM");
    expect(planAllows("FREE", "signal.scenarios")).toBe(false);
    expect(planAllows("PREMIUM", "signal.scenarios")).toBe(true);
  });
});

describe("capChartQueryForVisitor", () => {
  it("conserve une fenêtre courte", () => {
    expect(capChartQueryForVisitor({ range: "1M" })).toEqual({
      range: "1M",
      interval: undefined,
      capped: false,
    });
    expect(capChartQueryForVisitor({ range: "1A" }).capped).toBe(false);
    expect(capChartQueryForVisitor({ range: "1Y" }).capped).toBe(false);
    expect(capChartQueryForVisitor({ range: "3A" }).capped).toBe(false);
    expect(capChartQueryForVisitor({ range: "3Y" }).capped).toBe(false);
    expect(capChartQueryForVisitor({ range: "5A" }).capped).toBe(false);
    expect(capChartQueryForVisitor({ range: "5Y" }).capped).toBe(false);
  });

  it("ramène MAX et les fenêtres plus longues que 5 ans à 5A", () => {
    expect(capChartQueryForVisitor({ range: "MAX" })).toMatchObject({ range: "5A", capped: true });
    expect(capChartQueryForVisitor({ range: "10A" })).toMatchObject({ range: "5A", capped: true });
    expect(capChartQueryForVisitor({ range: "10Y" })).toMatchObject({ range: "5A", capped: true });
    expect(capChartQueryForVisitor({ range: "ALL" })).toMatchObject({ range: "5A", capped: true });
  });

  it("conserve un from/to d'au plus cinq ans", () => {
    const oneYear = capChartQueryForVisitor({ from: "2025-01-01", to: "2025-12-31" });
    expect(oneYear.capped).toBe(false);
    expect(oneYear.from).toBe("2025-01-01");
    const fiveYears = capChartQueryForVisitor({ from: "2020-11-23", to: "2025-11-23" });
    expect(fiveYears.capped).toBe(false);
    expect(fiveYears.from).toBe("2020-11-23");
    expect(fiveYears.to).toBe("2025-11-23");
  });

  it("plafonne un from/to plus large que cinq ans", () => {
    const q = capChartQueryForVisitor({ from: "2015-01-01", to: "2025-12-31" });
    expect(q.capped).toBe(true);
    expect(q.range).toBe("5A");
    expect(q.from).toBeUndefined();
  });
});

describe("isLockedChartRange / isAnonChartRangeAllowed", () => {
  it("verrouille seulement les fenêtres plus longues que 5 ans", () => {
    expect(isLockedChartRange("MAX")).toBe(true);
    expect(isLockedChartRange("10A")).toBe(true);
    expect(isLockedChartRange("ALL")).toBe(true);
    expect(isLockedChartRange("1A")).toBe(false);
    expect(isLockedChartRange("3A")).toBe(false);
    expect(isLockedChartRange("3Y")).toBe(false);
    expect(isLockedChartRange("5A")).toBe(false);
    expect(isLockedChartRange("5Y")).toBe(false);
    expect(isAnonChartRangeAllowed("3M")).toBe(true);
    expect(isAnonChartRangeAllowed("5A")).toBe(true);
    expect(isAnonChartRangeAllowed("MAX")).toBe(false);
  });
});

function sampleCompany(over: Partial<CompanyFullDataset> = {}): CompanyFullDataset {
  return {
    ticker: "SNTS",
    name: "Sonatel",
    country: "Sénégal",
    countryFlag: "🇸🇳",
    sector: "Télécoms",
    per: 12.5,
    mktcap: 2500,
    roe: 22,
    netMargin: 18,
    debtRatio: 30,
    pbRatio: 2.1,
    revenueGrowth: 8,
    fcf: 120,
    prevPer: 11,
    prevMktcap: 2000,
    prevRoe: 20,
    prevNetMargin: 16,
    prevDebtRatio: 28,
    prevPbRatio: 1.9,
    prevRevenueGrowth: 7,
    prevFcf: 100,
    prices: { 2023: 14000, 2024: 15000, 2025: 16000 },
    dividends: { 2023: 400, 2024: 450, 2025: 500 },
    priceAsOf: "2025-11-20",
    color: "#d4a017",
    dataSource: "BRVM_OFFICIEL",
    lastSyncedAt: "2025-11-20T18:00:00.000Z",
    ...over,
  };
}

describe("slimCompanyForVisitor", () => {
  it("ne laisse que le dernier cours et le dernier dividende, sans ratios", () => {
    const slim = slimCompanyForVisitor(sampleCompany());
    expect(slim.prices).toEqual({ 2025: 16000 });
    expect(slim.dividends).toEqual({ 2025: 500 });
    expect(slim.per).toBe(0);
    expect(slim.roe).toBeNull();
    expect(slim.netMargin).toBeNull();
    expect(slim.pbRatio).toBeNull();
    expect(slim.prevRoe).toBeNull();
    expect(slim.mktcap).toBe(2500);
    expect(slim.name).toBe("Sonatel");
    expect(lastPositiveYear({ 2020: 0, 2021: 10, 2022: 0 })).toBe(2021);
  });

  it("présent le jeu complet seulement pour un compte connecté", () => {
    const dataset = { years: [2023, 2024, 2025], companies: [sampleCompany()], generatedAt: "2025-11-20T18:00:00.000Z" };
    const visitor = viewerFromSession(null, true);
    const user = viewerFromSession("u1", true);
    expect(presentCompaniesFullDataset(dataset, user).companies[0]!.per).toBe(12.5);
    expect(presentCompaniesFullDataset(dataset, visitor).companies[0]!.per).toBe(0);
    expect(presentCompaniesFullDataset(dataset, visitor).companies[0]!.prices).toEqual({ 2025: 16000 });
  });

  it("conserve le dernier dividende même à 0, pour afficher « Pas de dividende »", () => {
    const none = slimCompanyForVisitor(
      sampleCompany({ ticker: "SAFC", dividends: { 2016: 0, 2020: 0, 2025: 0 } })
    );
    expect(none.dividends).toEqual({ 2025: 0 });
    expect(Object.values(none.dividends).every((amt) => amt === 0)).toBe(true);

    const lastIsNil = slimCompanyForVisitor(sampleCompany({ dividends: { 2023: 400, 2024: 450, 2025: 0 } }));
    expect(lastIsNil.dividends).toEqual({ 2025: 0 });

    const empty = slimCompanyForVisitor(sampleCompany({ dividends: {} }));
    expect(empty.dividends).toEqual({});
  });
});

describe("presentNgxBoardRows", () => {
  const row = {
    ticker: "DANGCEM",
    name: "Dangote Cement",
    sectorSlug: "industrial-goods",
    sectorLabel: "Industrial goods",
    close: 500,
    changePercent: 1.2,
    marketCapBn: 8000,
    fcfa: 2800,
    return1yPercent: 20,
    yieldPercent: 4,
    spark: null,
    score: 72,
    scoreMode: "FULL",
    signal: { label: "ACHAT", color: "#00aa00" },
    confidence: "Élevée",
  } as unknown as NgxBoardRow;

  it("retire score, signal et confiance du visiteur, pas les cours", () => {
    const visitor = viewerFromSession(null, true);
    const [out] = presentNgxBoardRows([row], visitor);
    expect(out!.close).toBe(500);
    expect(out!.changePercent).toBe(1.2);
    expect(out!.spark).toBeNull();
    expect(out!.score).toBeNull();
    expect(out!.signal).toBeNull();
    expect(out!.confidence).toBeNull();
  });

  it("laisse les scores à un compte connecté", () => {
    const [out] = presentNgxBoardRows([row], viewerFromSession("u1", true));
    expect(out!.score).toBe(72);
    expect(out!.signal?.label).toBe("ACHAT");
  });
});


describe("presentDividendCalendar", () => {
  it("ne conserve que le dernier dividende par société pour un visiteur", () => {
    const event = (ticker: string, year: number, displayDate: string) => ({
      id: `${ticker}-${year}`,
      ticker,
      name: ticker,
      sector: "Banques",
      country: "Côte d'Ivoire",
      countryFlag: "🇨🇮",
      year,
      amount: 100,
      close: 1000,
      yieldPercent: 10,
      displayDate,
      exDate: displayDate,
      paymentDate: null,
      precision: "ex" as const,
      source: "BRVM_OFFICIEL",
    });
    const data = {
      events: [event("BICC", 2023, "2023-07-01"), event("BICC", 2025, "2025-07-01"), event("SNTS", 2024, "2024-06-01")],
      years: [2025, 2024, 2023],
      calendarYears: [2025, 2024, 2023],
      sectors: ["Banques"],
      datedCount: 3,
      exerciceOnlyCount: 0,
      upcomingCount: 0,
      companies: 2,
      priceDate: "2026-11-20",
    };
    const visitor = presentDividendCalendar(data, viewerFromSession(null, true));
    expect(visitor.events.map((e) => `${e.ticker}-${e.year}`).sort()).toEqual(["BICC-2025", "SNTS-2024"]);
    expect(visitor.companies).toBe(2);
    const user = presentDividendCalendar(data, viewerFromSession("u1", true));
    expect(user.events).toHaveLength(3);
  });
});
