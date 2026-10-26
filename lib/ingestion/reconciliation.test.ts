import { describe, expect, it } from "vitest";
import { BRVM_SESSION_COLLAR_PERCENT, filterCanonicalByCollar } from "./price-collar";
import {
  canonicalRowsForPersist,
  canonicalSourceForDay,
  reconcilePriceQuotes,
  reconcilePriceBatch,
  reconcileIndexQuotes,
  canElevateCanonical,
  DISCREPANCY_THRESHOLD_PERCENT,
  sourceOutranks,
  sourcesOutranking,
} from "./reconciliation";
import type { RawPriceQuote, RawIndexQuote } from "./types";

function priceQuote(overrides: Partial<RawPriceQuote>): RawPriceQuote {
  return {
    ticker: "SNTS",
    closePrice: 31000,
    volume: null,
    source: "BRVM_OFFICIEL",
    date: "2026-08-07",
    fetchedAt: "2026-08-07T22:45:00.000Z",
    ...overrides,
  };
}

describe("reconcilePriceQuotes", () => {
  it("retient BRVM_OFFICIEL même si Sikafinance/Richbourse sont présents et différents", () => {
    const quotes = [
      priceQuote({ source: "BRVM_OFFICIEL", closePrice: 31000 }),
      priceQuote({ source: "SIKAFINANCE", closePrice: 31050 }),
      priceQuote({ source: "RICHBOURSE", closePrice: 30990 }),
    ];
    const { reconciled } = reconcilePriceQuotes("SNTS", "2026-08-07", quotes);
    expect(reconciled?.resolvedSource).toBe("BRVM_OFFICIEL");
    expect(reconciled?.closePrice).toBe(31000);
  });

  it("bascule sur Sikafinance si BRVM_OFFICIEL est absent", () => {
    const quotes = [
      priceQuote({ source: "SIKAFINANCE", closePrice: 31050 }),
      priceQuote({ source: "RICHBOURSE", closePrice: 30990 }),
    ];
    const { reconciled } = reconcilePriceQuotes("SNTS", "2026-08-07", quotes);
    expect(reconciled?.resolvedSource).toBe("SIKAFINANCE");
  });

  it("bascule sur Richbourse si seule cette source est disponible", () => {
    const quotes = [priceQuote({ source: "RICHBOURSE", closePrice: 30990 })];
    const { reconciled } = reconcilePriceQuotes("SNTS", "2026-08-07", quotes);
    expect(reconciled?.resolvedSource).toBe("RICHBOURSE");
  });

  it("retourne null si aucune source ne couvre ce ticker/cette date", () => {
    const quotes = [priceQuote({ ticker: "AUTRE" })];
    const { reconciled, discrepancy } = reconcilePriceQuotes("SNTS", "2026-08-07", quotes);
    expect(reconciled).toBeNull();
    expect(discrepancy).toBeNull();
  });

  it("ne signale PAS d'écart en dessous du seuil de 2%", () => {
    const quotes = [
      priceQuote({ source: "BRVM_OFFICIEL", closePrice: 31000 }),
      priceQuote({ source: "RICHBOURSE", closePrice: 31000 * (1 + DISCREPANCY_THRESHOLD_PERCENT / 100 - 0.001) }),
    ];
    const { discrepancy } = reconcilePriceQuotes("SNTS", "2026-08-07", quotes);
    expect(discrepancy).toBeNull();
  });

  it("signale un écart au-delà du seuil de 2% avec le detail par source", () => {
    const quotes = [
      priceQuote({ source: "BRVM_OFFICIEL", closePrice: 31000 }),
      priceQuote({ source: "SIKAFINANCE", closePrice: 32500 }), // +4.8%
      priceQuote({ source: "RICHBOURSE", closePrice: 31010 }),
    ];
    const { discrepancy } = reconcilePriceQuotes("SNTS", "2026-08-07", quotes);
    expect(discrepancy).not.toBeNull();
    expect(discrepancy?.brvmValue).toBe(31000);
    expect(discrepancy?.sikaValue).toBe(32500);
    expect(discrepancy?.richValue).toBe(31010);
    expect(discrepancy?.deltaPercent).toBeGreaterThan(DISCREPANCY_THRESHOLD_PERCENT);
  });
});

describe("reconcilePriceBatch", () => {
  it("traite plusieurs tickers indépendamment dans un seul passage", () => {
    const quotes = [
      priceQuote({ ticker: "SNTS", source: "BRVM_OFFICIEL", closePrice: 31000 }),
      priceQuote({ ticker: "SGBC", source: "BRVM_OFFICIEL", closePrice: 38000 }),
      priceQuote({ ticker: "SGBC", source: "SIKAFINANCE", closePrice: 41000 }), // écart > 2%
    ];
    const { reconciled, discrepancies } = reconcilePriceBatch(quotes);
    expect(reconciled).toHaveLength(2);
    expect(discrepancies).toHaveLength(1);
    expect(discrepancies[0].ticker).toBe("SGBC");
  });
});

describe("reconcileIndexQuotes", () => {
  function indexQuote(overrides: Partial<RawIndexQuote>): RawIndexQuote {
    return {
      code: "BRVM_COMPOSITE",
      label: "BRVM - COMPOSITE",
      value: 485.48,
      changePercent: 0.66,
      source: "BRVM_OFFICIEL",
      date: "2026-08-07",
      fetchedAt: "2026-08-07T22:45:00.000Z",
      ...overrides,
    };
  }

  it("classe BRVM_OFFICIEL > SIKAFINANCE > OUESTBOURSE > RICHBOURSE > MANUEL", () => {
    expect(sourceOutranks("BRVM_OFFICIEL", "SIKAFINANCE")).toBe(true);
    expect(sourceOutranks("SIKAFINANCE", "OUESTBOURSE")).toBe(true);
    expect(sourceOutranks("OUESTBOURSE", "RICHBOURSE")).toBe(true);
    expect(sourceOutranks("RICHBOURSE", "MANUEL")).toBe(true);
    expect(sourceOutranks("SIKAFINANCE", "BRVM_OFFICIEL")).toBe(false);
    expect(sourcesOutranking("SIKAFINANCE")).toEqual(["BRVM_OFFICIEL"]);
    expect(sourcesOutranking("OUESTBOURSE")).toEqual(["BRVM_OFFICIEL", "SIKAFINANCE"]);
  });

  it("retient BRVM_OFFICIEL en priorité et calcule l'écart max entre sources", () => {
    const quotes = [
      indexQuote({ source: "BRVM_OFFICIEL", value: 485.48 }),
      indexQuote({ source: "SIKAFINANCE", value: 485.48 }),
      indexQuote({ source: "RICHBOURSE", value: 485.48 }),
    ];
    const { reconciled, deltaPercent } = reconcileIndexQuotes("BRVM_COMPOSITE", "2026-08-07", quotes);
    expect(reconciled?.resolvedSource).toBe("BRVM_OFFICIEL");
    expect(deltaPercent).toBe(0);
  });

  it("n'élève pas Sika s'il existe déjà un point BRVM", () => {
    expect(canElevateCanonical("SIKAFINANCE", ["BRVM_OFFICIEL", "SIKAFINANCE"])).toBe(false);
    expect(canElevateCanonical("SIKAFINANCE", ["SIKAFINANCE"])).toBe(true);
    expect(canElevateCanonical("BRVM_OFFICIEL", ["SIKAFINANCE"])).toBe(true);
  });
});

describe("invariant canonique — une séance, une ligne", () => {
  it("élit exactement une source dès qu'il en existe une", () => {
    expect(canonicalSourceForDay([])).toBeNull();
    expect(canonicalSourceForDay(["SIKAFINANCE"])).toBe("SIKAFINANCE");
    expect(canonicalSourceForDay(["SIKAFINANCE", "BRVM_OFFICIEL"])).toBe("BRVM_OFFICIEL");
    expect(canonicalSourceForDay(["RICHBOURSE", "MANUEL", "SIKAFINANCE"])).toBe("SIKAFINANCE");
  });

  it("garde le 23/10 SNTS même si le collier le refuse contre un cours lointain", () => {
    const quotes = [
      priceQuote({
        ticker: "SNTS",
        date: "2026-10-22",
        closePrice: 42000,
        source: "BRVM_OFFICIEL",
      }),
      priceQuote({
        ticker: "SNTS",
        date: "2026-10-23",
        closePrice: 43850,
        source: "BRVM_OFFICIEL",
        changePercent: 4.4,
      }),
      priceQuote({
        ticker: "SNTS",
        date: "2026-10-23",
        closePrice: 43850,
        source: "SIKAFINANCE",
      }),
    ];
    const { reconciled } = reconcilePriceBatch(quotes);
    const collar = filterCanonicalByCollar(reconciled, {
      previousByTicker: new Map([["SNTS", { date: "2026-09-16", closePrice: 20000 }]]),
      config: {
        enabled: true,
        collarPercent: BRVM_SESSION_COLLAR_PERCENT,
        slackPercent: 0.5,
        maxGapDays: 40,
        overrideTickers: new Set(),
      },
    });
    expect(collar.rejected.some((row) => row.date === "2026-10-23")).toBe(true);

    const marked = canonicalRowsForPersist(reconciled);
    const keys = marked.map((row) => `${row.ticker}__${row.date}`);
    expect(new Set(keys).size).toBe(marked.length);
    expect(marked).toHaveLength(2);
    expect(marked.find((row) => row.date === "2026-10-23")?.resolvedSource).toBe("BRVM_OFFICIEL");
  });
});
