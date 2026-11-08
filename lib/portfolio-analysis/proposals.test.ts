import { describe, expect, it } from "vitest";
import type { PriceBar } from "@/lib/analysis/technical-plan";
import { indicativeFcfa, XOF_PER_EUR } from "@/lib/markets/fx";
import { analyzePortfolio, type AnalysisHoldingInput, type AnalysisInput, type MarketContext } from "./analyze";
import { EMPTY_INVESTOR_CRITERIA, riskPercentForProfile } from "./criteria";
import { emptyMacroReadings } from "./market-regime";
import { weeklyProposalBody } from "./notify-copy";

function bars(volume: number): PriceBar[] {
  const start = new Date("2026-09-01T00:00:00.000Z");
  return Array.from({ length: 20 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), close: 1000, volume };
  });
}

function market(ngnPerEur: number | null): MarketContext {
  return {
    series: { BRVM: [], NGX: [] },
    breadth: { BRVM: [], NGX: [] },
    macros: emptyMacroReadings(),
    ngnPerEur,
    fxAsOf: ngnPerEur == null ? null : "2026-11-01",
    fxSource: ngnPerEur == null ? null : "open.er-api.com",
  };
}

function line(patch: Partial<AnalysisHoldingInput> & Pick<AnalysisHoldingInput, "ticker" | "quantity" | "price">): AnalysisHoldingInput {
  return {
    name: patch.ticker,
    market: "BRVM",
    currency: "XOF",
    sector: "Banques",
    country: "Côte d'Ivoire",
    bars: bars(50_000),
    holdingStop: null,
    holdingTarget: null,
    ...patch,
  };
}

function run(patch: Partial<AnalysisInput> & Pick<AnalysisInput, "holdings">) {
  return analyzePortfolio({
    portfolioId: "p1",
    portfolioName: "Principal",
    profile: {
      ...EMPTY_INVESTOR_CRITERIA,
      lossTolerance: "ELEVEE",
      horizon: "TROIS_A_7_ANS",
      capacity: "ELEVEE",
      objective: "CROISSANCE",
      age: 40,
      riskPerPositionPct: 1,
    },
    setups: patch.holdings.map((holding) => ({
      ticker: holding.ticker,
      referencePrice: holding.price ?? 0,
      invalidation: holding.price == null ? null : holding.price * 0.9,
      target: holding.price == null ? null : holding.price * 1.3,
      riskReward: null,
      source: "technical" as const,
    })),
    market: market(1600),
    ...patch,
  });
}

describe("riskPercentForProfile", () => {
  it("dérive 1 %, 1,5 % ou 2 % puis resserre les profils prudents", () => {
    expect(riskPercentForProfile({ ...EMPTY_INVESTOR_CRITERIA, lossTolerance: "FAIBLE" }).percent).toBe(1);
    expect(riskPercentForProfile({ ...EMPTY_INVESTOR_CRITERIA, lossTolerance: "MODEREE" }).percent).toBe(1.5);
    expect(riskPercentForProfile({ ...EMPTY_INVESTOR_CRITERIA, lossTolerance: "ELEVEE" }).percent).toBe(2);
    expect(
      riskPercentForProfile({ ...EMPTY_INVESTOR_CRITERIA, lossTolerance: "ELEVEE", portfolioType: "TRADING" }).percent
    ).toBe(1);
    expect(
      riskPercentForProfile({ ...EMPTY_INVESTOR_CRITERIA, lossTolerance: "ELEVEE", age: 72 }).percent
    ).toBe(1);
    expect(riskPercentForProfile({ ...EMPTY_INVESTOR_CRITERIA, riskPerPositionPct: 1.25 })).toEqual({
      percent: 1.25,
      source: "explicit",
    });
  });
});

describe("analyzePortfolio", () => {
  it("propose d'alléger un titre au-dessus du budget et du plafond, sans changer la quantité détenue", () => {
    const analysis = run({
      holdings: [line({ ticker: "SNTS", name: "Sonatel", quantity: 100, price: 1000, sector: "Télécoms", country: "Sénégal" })],
    });
    const row = analysis.holdings[0];
    expect(row.quantity).toBe(100);
    expect(row.proposal.action).toBe("ALLEGER");
    expect(row.proposal.suggestedShares).toBeLessThan(100);
    expect(row.proposal.reasons).toContain("over_stock_limit");
    expect(analysis.buckets.find((bucket) => bucket.key === "SNTS")?.above).toBe(true);
    expect(row.planSource).toBe("technical");
    expect("score" in row).toBe(false);
  });

  it("met en avant un titre peu liquide et réduit la taille suggérée", () => {
    const analysis = run({
      holdings: [
        line({
          ticker: "PRSC",
          quantity: 1_000,
          price: 1000,
          bars: bars(10).map((bar, index) => ({ ...bar, volume: index % 2 === 0 ? 0 : 4_000, close: 1000 })),
        }),
      ],
    });
    const row = analysis.holdings[0];
    expect(row.liquidity.band).toBe("ILLIQUIDE");
    expect(row.proposal.reasons).toContain("illiquid_exit");
    expect(row.proposal.action).toBe("ALLEGER");
    expect(row.proposal.suggestedShares).toBeLessThanOrEqual(row.liquidity.maxShares ?? 0);
  });

  it("propose de renforcer une ligne petite au rapport favorable", () => {
    const analysis = run({
      holdings: [
        line({ ticker: "SGBC", quantity: 99, price: 10_000 }),
        line({ ticker: "SNTS", name: "Sonatel", quantity: 10, price: 1000, sector: "Télécoms", country: "Sénégal" }),
      ],
    });
    const snts = analysis.proposals.find((proposal) => proposal.ticker === "SNTS");
    expect(snts?.action).toBe("RENFORCER");
    expect(snts?.suggestedShares).toBeGreaterThan(10);
    expect(snts?.reasons).toContain("rr_strong");
  });

  it("suggère de sortir si le cours a passé l'invalidation", () => {
    const analysis = run({
      holdings: [line({ ticker: "BOAM", quantity: 12, price: 800 })],
      setups: [
        {
          ticker: "BOAM",
          referencePrice: 800,
          invalidation: 900,
          target: 1100,
          riskReward: null,
          source: "technical",
        },
      ],
    });
    expect(analysis.proposals[0]).toMatchObject({ action: "SORTIR", suggestedShares: 0, reasons: ["stop_breached"] });
    expect(analysis.holdings[0].quantity).toBe(12);
  });

  it("convertit BRVM et NGX en FCFA avec la même formule que la colonne Cours FCFA", () => {
    const ngnPerEur = 1600;
    const analysis = run({
      market: market(ngnPerEur),
      holdings: [
        line({ ticker: "SNTS", quantity: 10, price: 10_000 }),
        line({
          ticker: "GTCO",
          name: "GTCO",
          market: "NGX",
          currency: "NGN",
          quantity: 1000,
          price: 80,
          country: "Nigeria",
        }),
      ],
    });
    const gtco = analysis.holdings.find((holding) => holding.ticker === "GTCO");
    const exact = (80 * XOF_PER_EUR) / ngnPerEur;
    expect(gtco?.priceFcfa).toBeCloseTo(exact);
    expect(gtco?.displayPriceFcfa).toBe(indicativeFcfa(80, ngnPerEur));
    expect(analysis.capitalFcfa).toBeCloseTo(10 * 10_000 + 1000 * exact);
    expect(analysis.fx.xofPerNgn).toBeCloseTo(XOF_PER_EUR / ngnPerEur);
    const fxSlot = analysis.macros.find((reading) => reading.id === "xof_per_ngn");
    expect(fxSlot?.value).toBeCloseTo(XOF_PER_EUR / ngnPerEur);
    expect(analysis.macros.find((reading) => reading.id === "uemoa_inflation")?.value).toBeNull();
  });

  it("laisse le naira hors du total quand le taux manque, et l'affiche N/D", () => {
    const analysis = run({
      market: market(null),
      holdings: [
        line({ ticker: "SNTS", quantity: 10, price: 10_000 }),
        line({ ticker: "GTCO", market: "NGX", currency: "NGN", quantity: 1000, price: 80, country: "Nigeria" }),
      ],
    });
    expect(analysis.capitalFcfa).toBe(100_000);
    expect(analysis.unconvertedTickers).toEqual(["GTCO"]);
    expect(analysis.coherence).toContain("fx_incomplete");
    expect(analysis.proposals.find((proposal) => proposal.ticker === "GTCO")?.action).toBe("SURVEILLER");
    expect(analysis.proposals.find((proposal) => proposal.ticker === "GTCO")?.reasons).toContain("fx_missing");
    expect(analysis.macros.find((reading) => reading.id === "bceao_policy_rate")?.value).toBeNull();
  });

  it("rédige une notification sans ordre impératif", () => {
    const analysis = run({
      holdings: [line({ ticker: "SNTS", quantity: 100, price: 1000 })],
    });
    const body = weeklyProposalBody([analysis]);
    expect(body).toMatch(/Alléger SNTS/);
    expect(body).toMatch(/pas un conseil en investissement/);
  });
});
