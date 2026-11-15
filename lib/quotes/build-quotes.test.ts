import { describe, expect, it } from "vitest";
import { buildLatestQuotes } from "./build-quotes";
import { parseQuoteMarket, parseTickerList, quoteChanged } from "./types";
import { holdingsBehindQuotes } from "./holdings-sync";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";

const row = (ticker: string, date: string, close: number, changePercent: number | null, ingestedAt = `${date}T18:58:47.810Z`) => ({
  ticker,
  date: new Date(`${date}T00:00:00.000Z`),
  close: String(close),
  changePercent: changePercent == null ? null : String(changePercent),
  ingestedAt: new Date(ingestedAt),
});

describe("buildLatestQuotes", () => {
  it("dernier cours canonique + variation publiée (SLBC 12/11 : 42 945, +7,36 %)", () => {
    const [q] = buildLatestQuotes("BRVM", [row("SLBC", "2026-11-11", 40000, 0), row("SLBC", "2026-11-12", 42945, 7.36)]);
    expect(q).toMatchObject({
      ticker: "SLBC",
      market: "BRVM",
      close: 42945,
      prevClose: 40000,
      changePercent: 7.36,
      changeAbs: 2945,
      date: "2026-11-12",
      asOf: "2026-11-12T18:58:47.810Z",
    });
  });

  it("sans variation publiée : recalculée vs séance précédente", () => {
    const [q] = buildLatestQuotes("NGX", [row("MTNN", "2026-11-13", 110, null), row("MTNN", "2026-11-12", 100, null)]);
    expect(q!.changePercent).toBe(10);
    expect(q!.prevClose).toBe(100);
  });

  it("une seule séance : variation publiée seule, écart déduit", () => {
    const [q] = buildLatestQuotes("BRVM", [row("X", "2026-11-13", 105, 5)]);
    expect(q!.prevClose).toBeNull();
    expect(q!.changePercent).toBe(5);
    expect(q!.changeAbs).toBe(5);
  });

  it("ignore les cours nuls / absents", () => {
    expect(buildLatestQuotes("BRVM", [row("Z", "2026-11-13", 0, null)])).toEqual([]);
  });

  it("fractionnement : séance précédente ramenée sur la nouvelle base", () => {
    const split: AdjustmentAction = {
      ticker: "SNTS",
      kind: "SPLIT",
      effectiveDate: "2026-11-13",
      factor: 10,
      oldShares: 1,
      newShares: 10,
      adjustPrices: true,
      label: "1:10",
    } as AdjustmentAction;
    const [q] = buildLatestQuotes(
      "BRVM",
      [row("SNTS", "2026-11-12", 25000, null), row("SNTS", "2026-11-13", 2600, 4)],
      new Map([["SNTS", [split]]])
    );
    expect(q!.close).toBe(2600);
    expect(q!.prevClose).toBe(2500);
    expect(q!.changePercent).toBe(4);
  });
});

describe("types / synchronisation", () => {
  it("parse market et tickers", () => {
    expect(parseQuoteMarket("ngx")).toBe("NGX");
    expect(parseQuoteMarket("x")).toBeNull();
    expect(parseTickerList(" snts, SGBC,snts,<script>")).toEqual(["SNTS", "SGBC"]);
    expect(parseTickerList(null)).toEqual([]);
  });

  it("quoteChanged : date, cours ou variation", () => {
    const base = buildLatestQuotes("BRVM", [row("A", "2026-11-12", 10, 1)])[0]!;
    expect(quoteChanged(undefined, base)).toBe(true);
    expect(quoteChanged(base, { ...base })).toBe(false);
    expect(quoteChanged(base, { ...base, close: 11 })).toBe(true);
    expect(quoteChanged(base, { ...base, date: "2026-11-13" })).toBe(true);
  });

  it("portefeuille : relire seulement si un cours diffère", () => {
    const q = buildLatestQuotes("BRVM", [row("SLBC", "2026-11-12", 42945, 7.36)]);
    expect(holdingsBehindQuotes([{ ticker: "SLBC", currentPrice: 42945, currentPriceDate: "2026-11-12" }], q)).toBe(false);
    expect(holdingsBehindQuotes([{ ticker: "SLBC", currentPrice: 40000, currentPriceDate: "2026-11-12" }], q)).toBe(true);
    expect(holdingsBehindQuotes([{ ticker: "SLBC", currentPrice: 40000, currentPriceDate: "2026-11-11" }], q)).toBe(true);
    expect(holdingsBehindQuotes([{ ticker: "SLBC", currentPrice: "N/D", currentPriceDate: "N/D" }], q)).toBe(true);
    expect(holdingsBehindQuotes([{ ticker: "SNTS", currentPrice: 1, currentPriceDate: "2026-11-01" }], q)).toBe(false);
  });
});
