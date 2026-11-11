import { describe, expect, it } from "vitest";
import { fixtureSheetInput } from "@/lib/ngx/__fixtures__";
import { buildNgxSheet } from "@/lib/ngx/sheet-model";
import { LIQUIDITY_BANDS, readBrvmLiquidity } from "./brvm-analysis";
import { buildNgxFundamentalAnalysis, latestNgxDividend, ngxFundamentalInput, yearEndPrices } from "./ngx-adapter";

function setup() {
  const input = fixtureSheetInput();
  const model = buildNgxSheet(input);
  const args = {
    company: input.company,
    model,
    universe: input.universe,
    series: input.series,
    today: input.today,
  };
  return { input, model, args };
}

describe("analyse fondamentale NGX (composant partagé avec la BRVM)", () => {
  it("garde les 8 étapes de la BRVM, dans le même ordre", () => {
    const { args } = setup();
    const analysis = buildNgxFundamentalAnalysis(args);
    expect(analysis.steps.map((s) => s.id)).toEqual([
      "presentation",
      "performance",
      "outlook",
      "price",
      "valuation",
      "sector",
      "dividends",
      "conclusion",
    ]);
  });

  it("compare aux sociétés NGX du même groupe sectoriel et les cite", () => {
    const { args, model } = setup();
    const analysis = buildNgxFundamentalAnalysis(args);
    const per = analysis.sector.rows.find((r) => r.key === "per")!;
    const tickers = per.peers.map((p) => p.ticker).sort();
    expect(tickers).toEqual(["PEERA", "PEERB", "PEERC", "PEERD"]);
    expect(tickers).not.toContain("DEMOCEM");
    // Libellé affiché = nom du secteur, pas la clé de regroupement.
    expect(analysis.sector.name).toBe(model.sector.name);
    expect(analysis.presentation.sector).toBe(model.sector.name);
    expect(per.aggregator).toBe("median");
  });

  it("reprend les comptes en Md ₦ sans rien inventer", () => {
    const { args, model } = setup();
    const input = ngxFundamentalInput(args);
    expect(input.market).toBe("NGX");
    expect(input.growthMeasure).toBe("cagr");
    expect(input.income.map((y) => y.year)).toEqual(model.performance.years.map((y) => y.year));
    expect(input.income.map((y) => y.revenue)).toEqual(model.performance.years.map((y) => y.revenueBn));
    expect(input.debtRatio).toBeNull();
    expect(input.fcf).toBeNull();
    const analysis = buildNgxFundamentalAnalysis(args);
    expect(analysis.performance.debtRatio).toBeNull();
    expect(analysis.price.close).toBe(model.header.close);
  });

  it("croissance du CA comparée en TCAM pour la société comme pour les pairs", () => {
    const { args, model } = setup();
    const analysis = buildNgxFundamentalAnalysis(args);
    const growth = analysis.sector.rows.find((r) => r.key === "revenueGrowth")!;
    expect(growth.company).toBeCloseTo(model.performance.revenueCagr.cagr!, 6);
  });

  it("valorisation multi-méthodes : fourchette non vide quand plusieurs méthodes sont calculables", () => {
    const { args } = setup();
    const analysis = buildNgxFundamentalAnalysis(args);
    expect(analysis.valuation.estimates.length).toBeGreaterThan(0);
    if (analysis.valuation.estimates.length >= 2) expect(analysis.valuation.rangeMode).toBe("range");
  });
});

describe("liquidité par place", () => {
  it("NGX : seuils en nairas de la politique Trading, sans seuil de volume en titres", () => {
    expect(LIQUIDITY_BANDS.NGX.ok).toBe(100_000_000);
    expect(LIQUIDITY_BANDS.NGX.shareIlliquidBelow).toBeNull();
    expect(LIQUIDITY_BANDS.BRVM.ok).toBe(50_000_000);
  });

  it("une même série est lue selon la place", () => {
    // 60 M de valeur par séance : liquide en FCFA (BRVM), mince en nairas (NGX).
    const series = Array.from({ length: 80 }, (_, i) => ({
      time: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      value: 100,
      volume: 600_000,
    }));
    expect(readBrvmLiquidity(series, "BRVM").level).toBe("OK");
    expect(readBrvmLiquidity(series, "NGX").level).toBe("THIN");
  });
});

describe("aides", () => {
  it("dernier dividende : ligne canonique la plus récente, null sans ligne", () => {
    expect(latestNgxDividend([])).toBeNull();
    expect(
      latestNgxDividend([
        { year: 2024, amount: 2, exDate: null, paymentDate: null, isCanonical: true, source: "NGX_OFFICIEL" },
        { year: 2025, amount: 3, exDate: null, paymentDate: null, isCanonical: false, source: "MANUEL" },
        { year: 2025, amount: 3.5, exDate: null, paymentDate: null, isCanonical: true, source: "NGX_OFFICIEL" },
      ]),
    ).toBe(3.5);
  });

  it("dernière clôture de chaque année", () => {
    expect(
      yearEndPrices([
        { time: "2025-12-30", value: 10 },
        { time: "2024-12-31", value: 8 },
        { time: "2025-12-31", value: 11 },
        { time: "2026-01-02", value: 0 },
      ]),
    ).toEqual({ 2024: 8, 2025: 11 });
  });
});
