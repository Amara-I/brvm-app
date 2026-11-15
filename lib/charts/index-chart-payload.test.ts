import { describe, expect, it } from "vitest";
import { buildIndexChartPayload } from "./index-chart-payload";

function daily(n: number, from = "2024-01-02") {
  const d = new Date(`${from}T00:00:00.000Z`);
  return Array.from({ length: n }, (_, i) => {
    const t = new Date(d.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    return { time: t, value: 200 + (i % 9) * 0.5 };
  });
}

describe("buildIndexChartPayload", () => {
  it("renvoie la forme workbench, sans signaux ni fondamentaux", () => {
    const p = buildIndexChartPayload(
      {
        code: "BRVM_COMPOSITE",
        name: "BRVM Composite",
        exchange: "BRVM",
        series: daily(400),
        source: "BRVM_OFFICIEL",
        storedHistoryPoints: 2500,
      },
      { range: "1A", interval: "1D" }
    );
    expect(p.ticker).toBe("BRVM_COMPOSITE");
    expect(p.stats.historyPoints).toBe(400);
    expect(p.series.length).toBeGreaterThan(0);
    expect(p.series.every((pt) => pt.volume == null)).toBe(true);
    expect(p.fundamentals).toEqual({ per: null, mktCapMds: null, dividendYieldPercent: null });
    expect(p.ngx).toBeUndefined();
    expect(p.index.exchange).toBe("BRVM");
    expect(p.index.storedHistoryPoints).toBe(2500);
    expect(p.corporateActions).toEqual([]);
    expect("analysis" in p).toBe(false);
  });

  it("ajoute le bloc ngx pour un indice NGX (tuiles 52 semaines, pas de capi)", () => {
    const p = buildIndexChartPayload({
      code: "NGX_ASI",
      name: "ASI",
      exchange: "NGX",
      series: daily(60),
      source: "NGX_OFFICIEL",
    });
    expect(p.countryFlag).toBe("🇳🇬");
    expect(p.ngx?.kind).toBe("index");
    expect(p.ngx?.mktCapBn).toBeNull();
  });

  it("MAX : série complète, lookback épuisé", () => {
    const series = daily(80);
    const p = buildIndexChartPayload(
      { code: "BRVM_30", name: "BRVM 30", exchange: "BRVM", series, source: null },
      { range: "MAX" }
    );
    expect(p.series).toHaveLength(80);
    expect(p.lookback).toEqual([]);
    expect(p.stats.lookbackExhausted).toBe(true);
    expect(p.stats.range).toBe("MAX");
  });

  it("série vide : tout N/D, pas d'exception", () => {
    const p = buildIndexChartPayload({
      code: "BRVM_COMPOSITE",
      name: "Composite",
      exchange: "BRVM",
      series: [],
      source: null,
    });
    expect(p.stats.lastClose).toBeNull();
    expect(p.series).toEqual([]);
    expect(p.index.high52).toBeNull();
  });
});
