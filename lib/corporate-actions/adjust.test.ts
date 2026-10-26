import { describe, expect, it } from "vitest";
import {
  adjustPerShareAmount,
  adjustSeries,
  dividendBasisDate,
  mergeSplitSessionQuotes,
  priceDivisor,
  restateSharesOutstanding,
  sessionChangePercent,
} from "./adjust";
import { splitMarkerLabel } from "./label";
import type { AdjustmentAction } from "./types";

const snts: AdjustmentAction = {
  ticker: "SNTS",
  kind: "SPLIT",
  effectiveDate: "2026-10-26",
  factor: 10,
  oldShares: 1,
  newShares: 10,
  adjustPrices: true,
  label: "Fractionnement 1:10 le 26/10/2026",
  sharesOutstandingBefore: 100_000_000,
};

describe("fractionnement SNTS 1:10", () => {
  it("formule le libellé demandé", () => {
    expect(splitMarkerLabel({ oldShares: 1, newShares: 10, effectiveDate: "2026-10-26" })).toBe(
      "Fractionnement 1:10 le 26/10/2026"
    );
  });

  it("divise les cours avant le 26/10 et multiplie les volumes", () => {
    const [friday, monday] = adjustSeries(
      [
        { time: "2026-10-23", value: 43850, volume: 1000 },
        { time: "2026-10-26", value: 4700, volume: 12000 },
      ],
      [snts]
    );
    expect(friday).toEqual({ time: "2026-10-23", value: 4385, volume: 10000 });
    expect(monday).toEqual({ time: "2026-10-26", value: 4700, volume: 12000 });
    expect(priceDivisor([snts], "2026-10-23")).toBe(10);
    expect(priceDivisor([snts], "2026-10-26")).toBe(1);
  });

  it("calcule la variation du 26/10 contre la clôture ajustée du 23/10", () => {
    const pct = sessionChangePercent(
      { date: "2026-10-23", close: 43850 },
      { date: "2026-10-26", close: 4700 },
      null,
      [snts]
    );
    expect(pct).toBeCloseTo(7.18, 2);
  });

  it("conserve la variation officielle dans le collier même si la veille manque", () => {
    const pct = sessionChangePercent(
      { date: "2026-10-22", close: 42000 },
      { date: "2026-10-26", close: 4700 },
      7.18,
      [snts]
    );
    expect(pct).toBe(7.18);
  });

  it("ignore une variation officielle non ajustée le jour du split", () => {
    const pct = sessionChangePercent(
      { date: "2026-10-23", close: 43850 },
      { date: "2026-10-26", close: 4700 },
      -89.28,
      [snts]
    );
    expect(pct).toBeCloseTo(7.18, 2);
  });

  it("ramène une impression du jour J encore sur l'ancienne échelle", () => {
    const adjusted = adjustSeries(
      [
        { time: "2026-10-23", value: 43850, volume: null },
        { time: "2026-10-26", value: 43850, volume: null },
      ],
      [snts]
    );
    expect(adjusted[1]?.value).toBe(4385);
  });

  it("préfère le cours post-split s'il côtoie l'ancien niveau le même jour", () => {
    const merged = mergeSplitSessionQuotes(
      [{ time: "2026-10-26", value: 42000, volume: 100 }],
      [{ time: "2026-10-26", value: 4700, volume: 8000, canonical: false, sourceRank: 0 }],
      [snts]
    );
    expect(merged[0]?.value).toBe(4700);
  });

  it("laisse la capitalisation inchangée et le rendement cohérent", () => {
    const oldPrice = 43850;
    const oldShares = 100_000_000;
    const oldDps = 1655;
    const marketCap = oldPrice * oldShares;
    const newPrice = oldPrice / 10;
    const newShares = restateSharesOutstanding(oldShares, [snts]);
    const newDps = adjustPerShareAmount(oldDps, dividendBasisDate(2025, null, [snts]), [snts]);
    expect(newShares).toBe(1_000_000_000);
    expect(newPrice * (newShares ?? 0)).toBe(marketCap);
    expect(newDps / newPrice).toBeCloseTo(oldDps / oldPrice, 8);
    expect(restateSharesOutstanding(1_000_000_000, [snts])).toBe(1_000_000_000);
  });

  it("ajuste le DPS 2026 reporté sans date de détachement, pas un détachement post-split", () => {
    expect(adjustPerShareAmount(1655, dividendBasisDate(2026, null, [snts]), [snts])).toBe(165.5);
    expect(adjustPerShareAmount(165.5, dividendBasisDate(2026, "2026-11-15", [snts]), [snts])).toBe(165.5);
  });

  it("cumule deux fractionnements et ignore une opération désactivée", () => {
    const older: AdjustmentAction = { ...snts, effectiveDate: "2018-01-01", factor: 2, adjustPrices: false };
    const newer: AdjustmentAction = { ...snts, effectiveDate: "2020-01-01", factor: 5, adjustPrices: true };
    expect(priceDivisor([older, newer], "2019-06-01")).toBe(5);
    expect(priceDivisor([older, newer], "2020-01-01")).toBe(1);
  });
});
