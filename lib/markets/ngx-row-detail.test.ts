import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureCompany, fixtureSeries } from "@/lib/ngx/__fixtures__";

const findFirst = vi.fn();
const findMany = vi.fn();
const queryRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    chartSeries: { findFirst: (...a: unknown[]) => findFirst(...a) },
    priceHistory: { findMany: (...a: unknown[]) => findMany(...a) },
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
  },
}));
vi.mock("@/lib/corporate-actions/load", () => ({ actionsByTicker: async () => new Map() }));
vi.mock("@/lib/markets/fx", async (orig) => ({
  ...(await orig<typeof import("@/lib/markets/fx")>()),
  latestEurNgnRate: async () => ({ date: "2026-11-13", ngnPerEur: 1700, source: "test" }),
}));
const universe = [
  fixtureCompany("AAA", 120, { netIncome: [30, 40, 50, 60, 70], revenue: [200, 230, 260, 300, 340], equity: 400, dps: [2, 2.5, 3], sector: "CONSUMER GOODS" }),
  fixtureCompany("BBB", 50, { netIncome: [10, 12], revenue: [80, 90], equity: 100 }),
  fixtureCompany("CCC", 10),
];
vi.mock("./ngx-sheet", () => ({
  loadNgxUniverse: async () => ({ rows: universe.map((c, i) => ({ id: `id${i}`, ticker: c.ticker })), universe }),
}));

import { loadNgxRowDetailUncached } from "./ngx-row-detail";

const series = fixtureSeries(500, 80);
const compact = series.map((p) => ({ t: p.time, v: p.value, q: p.volume }));
const yearlyCloses: Record<string, number> = { "2014": 20, "2016": 30, "2018": 40, "2020": 50, "2021": 55, "2022": 60, "2023": 70, "2024": 80, "2025": 90 };

describe("loadNgxRowDetailUncached", () => {
  beforeEach(() => {
    findFirst.mockReset();
    findMany.mockReset();
    queryRaw.mockReset();
  });

  it("une seule ligne chart_series lue, détail complet et jamais tout l'historique", async () => {
    findFirst.mockResolvedValue({ points: compact, pointCount: compact.length, meta: { yearlyCloses, adjustmentFingerprint: "none" } });
    const d = await loadNgxRowDetailUncached("aaa");
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst.mock.calls[0][0].where).toMatchObject({ rangeKey: "1A", symbol: "AAA", exchange: "NGX" });
    expect(findMany).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(d).not.toBeNull();
    expect(d!.ticker).toBe("AAA");
    expect(d!.perf5Percent).not.toBeNull();
    expect(d!.perf10Percent).not.toBeNull();
    expect(d!.firstYear).toBe(2014);
    expect(d!.per).toBeGreaterThan(0);
    expect(d!.roePercent).not.toBeNull();
    expect(d!.horizons).not.toBeNull();
    expect(d!.signal?.label).toBeTruthy();
    expect(d!.signal!.summary).toMatch(/Signal technique/);
    expect(d!.risk.pillars.length).toBe(4);
    const liq = d!.risk.pillars.find((p) => p.key === "liquidite")!;
    expect(liq.note).toMatch(/Md ₦/);
    expect(Object.keys(d!.policies)).toHaveLength(4);
    expect(JSON.stringify(d).length).toBeLessThan(6000);
  });

  it("ticker inconnu → null ; sans cours → N/D (rien d'inventé)", async () => {
    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValue([]);
    queryRaw.mockResolvedValue([]);
    expect(await loadNgxRowDetailUncached("ZZZ")).toBeNull();
    const d = await loadNgxRowDetailUncached("CCC");
    expect(d!.perf5Percent).toBeNull();
    expect(d!.per).toBeNull();
    expect(d!.signal).toBeNull();
    expect(d!.horizons).toBeNull();
  });
});
