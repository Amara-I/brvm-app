import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("../corporate-actions/load", () => ({ actionsByTicker: async () => new Map() }));
vi.mock("../corporate-actions/present-series", () => ({
  presentCompanyCloses: async (_db: unknown, _id: string, _t: string, points: unknown[]) => ({
    points,
    actions: [],
    fingerprint: "none",
  }),
}));

import { refreshChartSeries } from "./refresh-chart-series";

function fakeDb(opts: { cachePoints: number; days: number }) {
  const rows = Array.from({ length: opts.days }, (_, i) => {
    const d = new Date("2021-10-27T00:00:00.000Z");
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d, closePrice: 10 + i, volume: 100, source: "NGX_OFFICIEL" };
  });
  const last = rows[rows.length - 1]!.date;
  const upserts: string[] = [];
  const db = {
    company: {
      findMany: async () => [
        { id: "c1", ticker: "AAA", exchange: "NGX" },
        { id: "c2", ticker: "BBB", exchange: "NGX" },
      ],
    },
    marketIndex: { findMany: async () => [] },
    chartSeries: {
      findMany: async () =>
        ["AAA", "BBB"].map((symbol) => ({ symbol, lastDate: last, meta: null, pointCount: opts.cachePoints })),
      upsert: async (args: { where: { uniq_chart_series_kind_symbol_range: { symbol: string; rangeKey: string } } }) => {
        const k = args.where.uniq_chart_series_kind_symbol_range;
        upserts.push(`${k.symbol}:${k.rangeKey}`);
        return {};
      },
    },
    priceHistory: { findMany: async () => rows },
    $queryRaw: async () => [
      { symbol: "AAA", last_date: last, days: opts.days },
      { symbol: "BBB", last_date: last, days: opts.days },
    ],
  };
  return { db: db as unknown as PrismaClient, upserts };
}

const quiet = { logger: () => undefined };

describe("refreshChartSeries NGX : historique chargé après coup", () => {
  it("reconstruit les sociétés dont le cache n'a qu'un point, 7 fenêtres chacune", async () => {
    const { db, upserts } = fakeDb({ cachePoints: 1, days: 400 });
    const summary = await refreshChartSeries({ exchange: "NGX", kinds: ["COMPANY"], ...quiet }, db);
    expect(summary.companiesUpdated).toBe(2);
    expect(upserts.filter((u) => u.startsWith("AAA:"))).toHaveLength(7);
    expect(summary.incomplete).toBe(false);
  });

  it("saute un cache déjà complet, sauf avec force", async () => {
    const skipped = fakeDb({ cachePoints: 400, days: 400 });
    expect((await refreshChartSeries({ exchange: "NGX", kinds: ["COMPANY"], ...quiet }, skipped.db)).companiesUpdated).toBe(0);
    const forced = fakeDb({ cachePoints: 400, days: 400 });
    expect(
      (await refreshChartSeries({ exchange: "NGX", kinds: ["COMPANY"], force: true, ...quiet }, forced.db)).companiesUpdated
    ).toBe(2);
  });

  it("n'applique pas le contrôle de profondeur à BRVM par défaut", async () => {
    const { db } = fakeDb({ cachePoints: 1, days: 400 });
    const summary = await refreshChartSeries({ exchange: "BRVM", kinds: ["COMPANY"], ...quiet }, db);
    expect(summary.companiesUpdated).toBe(0);
  });

  it("reprend après un symbole (after) et s'arrête sur le budget", async () => {
    const { db } = fakeDb({ cachePoints: 1, days: 400 });
    const resumed = await refreshChartSeries({ exchange: "NGX", kinds: ["COMPANY"], after: "AAA", ...quiet }, db);
    expect(resumed.companiesUpdated).toBe(1);
    const tight = await refreshChartSeries({ exchange: "NGX", kinds: ["COMPANY"], timeBudgetMs: 1_000, ...quiet }, db);
    expect(tight.incomplete).toBe(true);
    expect(tight.nextSymbol).toBe("AAA");
  });
});
