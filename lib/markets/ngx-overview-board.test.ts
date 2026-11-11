import { describe, expect, it } from "vitest";
import type { MarketIndexSnapshot } from "@/lib/api/market-summary-snapshot";
import {
  computeNgxMarketKpis,
  formatNgxAvgYield,
  isNgxBuySignal,
  orderNgxIndices,
} from "./ngx-overview-board";

function index(code: string, name: string, value = 1000): MarketIndexSnapshot {
  return { code, name, value, changePercent: 1.2, date: "2026-11-11", source: "NGX_OFFICIEL" };
}

describe("isNgxBuySignal", () => {
  it("compte uniquement les signaux techniques ACHAT et ACHAT FORT", () => {
    expect(isNgxBuySignal("ACHAT")).toBe(true);
    expect(isNgxBuySignal("ACHAT FORT")).toBe(true);
    expect(isNgxBuySignal("CONSERVER")).toBe(false);
    expect(isNgxBuySignal("ALLÉGER")).toBe(false);
    expect(isNgxBuySignal("VENDRE")).toBe(false);
    expect(isNgxBuySignal(null)).toBe(false);
    expect(isNgxBuySignal(undefined)).toBe(false);
  });
});

describe("computeNgxMarketKpis", () => {
  it("somme les caps connues, moyenne les rendements connus, et ignore les N/D", () => {
    const kpis = computeNgxMarketKpis([
      { marketCapBn: 10, yieldPercent: 4, signal: { label: "ACHAT" } },
      { marketCapBn: 30, yieldPercent: 6, signal: { label: "CONSERVER" } },
      { marketCapBn: null, yieldPercent: null, signal: null },
      { marketCapBn: 0, yieldPercent: Number.NaN, signal: { label: "ACHAT FORT" } },
    ]);
    expect(kpis.listed).toBe(4);
    expect(kpis.totalCapBn).toBe(40);
    expect(kpis.avgYieldPercent).toBe(5);
    expect(kpis.buySignals).toBe(2);
  });

  it("renvoie null (N/D) quand aucune cap ou aucun rendement n'est disponible", () => {
    const kpis = computeNgxMarketKpis([
      { marketCapBn: null, yieldPercent: null, signal: { label: "CONSERVER" } },
    ]);
    expect(kpis.totalCapBn).toBeNull();
    expect(kpis.avgYieldPercent).toBeNull();
    expect(kpis.buySignals).toBe(0);
    expect(formatNgxAvgYield(kpis.avgYieldPercent)).toBe("N/D");
  });

  it("formate le rendement moyen avec deux décimales", () => {
    expect(formatNgxAvgYield(5.8)).toBe("5.80%");
  });
});

describe("orderNgxIndices", () => {
  it("place NGX ASI en tête, puis les indices principaux, puis les sectoriels", () => {
    const ordered = orderNgxIndices([
      index("NGXBANK", "NGX Banking"),
      index("NGX30", "NGX 30"),
      index("NGX_ASI", "NGX All-Share Index"),
      index("NGXOILGAS", "NGX Oil & Gas"),
      index("NGXPREMIUM", "NGX Premium"),
    ]);
    expect(ordered.map((row) => row.code)).toEqual([
      "NGX_ASI",
      "NGX30",
      "NGXPREMIUM",
      "NGXBANK",
      "NGXOILGAS",
    ]);
  });
});
