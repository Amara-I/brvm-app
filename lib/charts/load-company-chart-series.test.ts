import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());
const readCached = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: { priceHistory: { findMany } } }));
vi.mock("./refresh-chart-series", () => ({ readCachedChartSeries: readCached }));
vi.mock("@/lib/corporate-actions/load", () => ({ actionsForTicker: vi.fn(async () => []) }));
vi.mock("@/lib/corporate-actions/present-series", () => ({
  presentCompanyCloses: vi.fn(async (_db: unknown, _id: string, _t: string, points: unknown[]) => ({
    points,
    actions: [],
    fingerprint: "none",
  })),
}));

import { loadCompanyChartSeries } from "./load-company-chart-series";

const p = (time: string, value: number) => ({ time, value, volume: null });
const row = (date: string, close: number, changePercent: number | null) => ({
  date: new Date(`${date}T00:00:00.000Z`),
  closePrice: close,
  changePercent,
  source: "BRVM_OFFICIEL",
  isCanonical: true,
});

beforeEach(() => {
  findMany.mockReset();
  readCached.mockReset();
});

describe("loadCompanyChartSeries — cache construit avec un cours provisoire", () => {
  it("la fiche affiche la clôture canonique du même jour, pas le cours du cache (SLBC 12/11)", async () => {
    readCached.mockResolvedValue({
      points: [p("2026-11-11", 40000), p("2026-11-12", 40000)],
      meta: { adjustmentFingerprint: "none", sources: ["BRVM_OFFICIEL"] },
      fingerprint: "x",
    });
    findMany.mockResolvedValue([row("2026-11-12", 42945, 7.36), row("2026-11-11", 40000, 0)]);
    const out = await loadCompanyChartSeries({ companyId: "c1", ticker: "SLBC", rangeParam: "MAX" });
    expect(out.series.at(-1)).toEqual(p("2026-11-12", 42945));
    expect(out.stale).toBe(true); // le client relit /api/charts
    expect(out.officialDayChangePercent).toBe(7.36);
  });

  it("cache à jour : série inchangée, pas périmée", async () => {
    readCached.mockResolvedValue({
      points: [p("2026-11-12", 42945), p("2026-11-13", 42950)],
      meta: { adjustmentFingerprint: "none", sources: ["BRVM_OFFICIEL"] },
      fingerprint: "x",
    });
    findMany.mockResolvedValue([row("2026-11-13", 42950, 0.01), row("2026-11-12", 42945, 7.36)]);
    const out = await loadCompanyChartSeries({ companyId: "c1", ticker: "SLBC", rangeParam: "MAX" });
    expect(out.series.at(-1)).toEqual(p("2026-11-13", 42950));
    expect(out.stale).toBe(false);
  });
});
