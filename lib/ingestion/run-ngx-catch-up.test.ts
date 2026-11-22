import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/charts/refresh-chart-series", () => ({ refreshChartSeries: vi.fn() }));
vi.mock("@/lib/cache/revalidate-quotes", () => ({ revalidateQuotesAfterWrite: vi.fn() }));
vi.mock("@/lib/markets/fx", () => ({ fetchEurNgnRate: vi.fn(), upsertEurNgnRate: vi.fn() }));
vi.mock("./alerts", () => ({ sendIngestionAlert: vi.fn() }));
const persistPriceQuotes = vi.fn(async (_db: unknown, raw: unknown[]) => ({ upserted: raw.length }));
vi.mock("./persist", () => ({
  persistPriceQuotes: (db: unknown, raw: unknown[]) => persistPriceQuotes(db, raw),
  persistIndexQuotes: vi.fn(),
}));
const loadNgxEquities = vi.fn();
vi.mock("./ngx/load-session", () => ({
  loadNgxEquities: (...args: unknown[]) => loadNgxEquities(...args),
  loadNgxCover: vi.fn(),
}));

import { catchUpRecentNgxSessions } from "./run-ngx-ingest";

function db(counts: Record<string, number>) {
  return {
    priceHistory: {
      groupBy: vi.fn(async () =>
        Object.entries(counts).map(([d, n]) => ({ date: new Date(`${d}T00:00:00.000Z`), _count: { _all: n } }))
      ),
    },
  } as unknown as PrismaClient;
}

const q = (symbol: string, tradeDate: string) => ({
  symbol,
  name: symbol,
  sector: null,
  board: null,
  close: 10,
  prevClose: null,
  changePercent: null,
  volume: 1,
  tradeDate,
});

describe("rattrapage des séances NGX récentes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("relit une séance manquante et une partielle, saute les complètes", async () => {
    const counts: Record<string, number> = {};
    for (const d of ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-11-03", "2026-11-06"]) counts[d] = 146;
    counts["2026-11-04"] = 87; // partielle ; 2026-11-02 et 2026-11-05 absentes
    loadNgxEquities.mockImplementation(async (opts: { onlyDate: string }) => ({
      ok: true,
      kind: "official-list",
      date: opts.onlyDate,
      warnings: [],
      quotes: [q("DANGCEM", opts.onlyDate), q("FBNH", opts.onlyDate), q("GHOST", opts.onlyDate)],
    }));
    const ids = new Map([
      ["DANGCEM", "c1"],
      ["FIRSTHOLDCO", "c2"],
    ]);
    const done = await catchUpRecentNgxSessions(db(counts), {
      latestIso: "2026-11-09",
      listings: [],
      companyIdByTicker: ids,
      maxSessions: 5,
      logger: () => undefined,
    });
    expect(done).toEqual(["2026-11-05", "2026-11-04", "2026-11-02"]);
    const asked = loadNgxEquities.mock.calls.map((c) => (c[0] as { onlyDate: string }).onlyDate);
    expect(asked).toEqual(["2026-11-05", "2026-11-04", "2026-11-02"]);
    // Ancien code FBNH rattaché à FIRSTHOLDCO ; ticker inconnu ignoré.
    const raw = persistPriceQuotes.mock.calls[0]![1] as { ticker: string }[];
    expect(raw.map((r) => r.ticker).sort()).toEqual(["DANGCEM", "FIRSTHOLDCO"]);
  });

  it("respecte le plafond de séances et passe les jours fériés", async () => {
    loadNgxEquities.mockResolvedValue({ ok: false, absent: true, warnings: [] });
    const done = await catchUpRecentNgxSessions(db({}), {
      latestIso: "2026-11-09",
      listings: [],
      companyIdByTicker: new Map(),
      maxSessions: 2,
      logger: () => undefined,
    });
    expect(done).toEqual([]);
    expect(loadNgxEquities).toHaveBeenCalledTimes(2);
  });
});
