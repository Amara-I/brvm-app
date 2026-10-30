import { describe, expect, it } from "vitest";
import { buildNgxChartPayload, fiftyTwoWeekRange } from "./ngx-chart-payload";
import { chartMarketConfig, chartStorageKey, ngxChartApiPath } from "./chart-market";

function daily(n: number, from = "2025-01-01") {
  const d = new Date(`${from}T00:00:00.000Z`);
  return Array.from({ length: n }, (_, i) => {
    const t = new Date(d.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    return { time: t, value: 10 + (i % 7) * 0.25, volume: i % 3 === 0 ? 0 : 500 };
  });
}

const base = {
  kind: "company" as const,
  symbol: "DANGCEM",
  name: "Dangote Cement",
  color: "#C9A84C",
  sector: "Industrie",
  actions: [],
  source: "NGX_OFFICIEL",
  sources: ["NGX_OFFICIEL"],
  sharesOutstanding: 17_040_507_405,
};

describe("buildNgxChartPayload", () => {
  it("renvoie la forme ChartApiPayload (pays, drapeau, séries, stats)", () => {
    const p = buildNgxChartPayload({ ...base, series: daily(400) }, { range: "1A", interval: "1D" });
    expect(p.country).toBe("Nigeria");
    expect(p.ticker).toBe("DANGCEM");
    expect(p.stats.historyPoints).toBe(400);
    expect(p.series.length).toBeGreaterThan(0);
    expect(p.series.length).toBeLessThanOrEqual(400);
    expect(p.ngx.kind).toBe("company");
    expect(p.fundamentals).toEqual({ per: null, mktCapMds: null, dividendYieldPercent: null });
  });

  it("fenêtre courte : renvoie moins de points que l'historique et un lookback", () => {
    const p = buildNgxChartPayload({ ...base, series: daily(400) }, { range: "1M", interval: "1D" });
    expect(p.series.length).toBeLessThan(400);
    expect(p.lookback.length).toBeGreaterThan(0);
  });

  it("indice : pas de capitalisation", () => {
    const p = buildNgxChartPayload({ ...base, kind: "index", symbol: "NGX_ASI", series: daily(60), sharesOutstanding: null });
    expect(p.ngx.kind).toBe("index");
    expect(p.ngx.mktCapBn).toBeNull();
  });

  it("split entre les deux dernières séances : variation de séance N/D", () => {
    const s = daily(5);
    const last = s[4]!.time;
    const p = buildNgxChartPayload({
      ...base,
      series: s,
      actions: [
        {
          ticker: "DANGCEM",
          kind: "SPLIT",
          effectiveDate: last,
          factor: 2,
          oldShares: 1,
          newShares: 2,
          label: "Split 2:1",
          adjustPrices: true,
        },
      ],
    });
    expect(p.stats.dayChangePercent).toBeNull();
    expect(p.corporateActions).toHaveLength(1);
  });

  it("série vide : tout N/D, pas d'exception", () => {
    const p = buildNgxChartPayload({ ...base, series: [] });
    expect(p.stats.lastClose).toBeNull();
    expect(p.ngx.high52).toBeNull();
    expect(p.series).toEqual([]);
  });
});

describe("fiftyTwoWeekRange", () => {
  it("ne prend que les 365 derniers jours", () => {
    const s = [
      { time: "2023-01-01", value: 999 },
      { time: "2025-06-01", value: 10 },
      { time: "2025-09-01", value: 14 },
      { time: "2026-01-01", value: 12 },
    ];
    expect(fiftyTwoWeekRange(s)).toEqual({ high: 14, low: 10 });
  });
  it("moins de 2 points : null", () => {
    expect(fiftyTwoWeekRange([{ time: "2026-01-01", value: 3 }])).toEqual({ high: null, low: null });
  });
});

describe("chart-market", () => {
  it("BRVM reste en FCFA entiers ; NGX en naira à 2 décimales", () => {
    expect(chartMarketConfig("BRVM").priceDecimals).toBe(0);
    expect(chartMarketConfig("NGX").priceDecimals).toBe(2);
    expect(chartMarketConfig("NGX").accountTools).toBe(true);
  });
  it("clé de tracés : NGX préfixé, BRVM inchangé", () => {
    expect(chartStorageKey("BRVM", "SGBC")).toBe("SGBC");
    expect(chartStorageKey("NGX", "DANGCEM")).toBe("NGX:DANGCEM");
    expect(ngxChartApiPath("DANGCEM", "1A")).toContain("/api/ngx/charts/DANGCEM");
  });
});
