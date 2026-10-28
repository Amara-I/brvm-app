import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  readFile: vi.fn(async () => {
    throw new Error("ENOENT");
  }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/charts/refresh-chart-series", () => ({ refreshChartSeries: vi.fn() }));
vi.mock("@/lib/markets/fx", () => ({ fetchEurNgnRate: vi.fn(), upsertEurNgnRate: vi.fn() }));

const loadNgxEquities = vi.fn();
const loadNgxCover = vi.fn();
const loadNgxSummaryQuotes = vi.fn();
vi.mock("./ngx/load-session", () => ({
  loadNgxSummaryQuotes: (...args: unknown[]) => loadNgxSummaryQuotes(...args),
  loadNgxEquities: (...args: unknown[]) => loadNgxEquities(...args),
  loadNgxCover: (...args: unknown[]) => loadNgxCover(...args),
}));
const upsertNgxListings = vi.fn();
const persistNgxQuotes = vi.fn(async (_db: unknown, quotes: unknown[], _ids?: unknown, _at?: unknown) => quotes.length);
const persistNgxIndices = vi.fn(async () => 20);
vi.mock("./run-ngx-ingest", () => ({
  upsertNgxListings: (...args: unknown[]) => upsertNgxListings(...args),
  persistNgxQuotes: (db: unknown, quotes: unknown[], ids: unknown, at: unknown) => persistNgxQuotes(db, quotes, ids, at),
  persistNgxIndices: (...args: unknown[]) => (persistNgxIndices as (...a: unknown[]) => Promise<number>)(...args),
}));

import { runNgxHistoryBackfill } from "./run-ngx-history";

function fakeDb(opts: { canonical?: number; asiDates?: string[]; existing?: { companyId: string; date: string }[] } = {}) {
  return {
    ingestionLog: {
      create: vi.fn(async () => ({ id: "log1" })),
      update: vi.fn(async () => ({})),
      findMany: vi.fn(async () => []),
    },
    company: {
      findMany: vi.fn(async () => [
        { id: "c-dangcem", ticker: "DANGCEM", name: "DANGOTE CEMENT PLC" },
        { id: "c-uba", ticker: "UBA", name: "UBA PLC" },
        { id: "c-fh", ticker: "FIRSTHOLDCO", name: "FIRST HOLDCO PLC" },
        { id: "c-zi", ticker: "ZICHIS", name: "ZICHIS AGRO ALLIED INDUSTRIES PLC" },
      ]),
    },
    priceHistory: {
      count: vi.fn(async () => opts.canonical ?? 0),
      findMany: vi.fn(async () => (opts.existing ?? []).map((row) => ({ companyId: row.companyId, date: new Date(`${row.date}T00:00:00.000Z`) }))),
    },
    marketIndexValue: {
      findMany: vi.fn(async () => (opts.asiDates ?? []).map((d) => ({ date: new Date(`${d}T00:00:00.000Z`) }))),
    },
  } as unknown as PrismaClient;
}

const quote = (symbol: string, tradeDate: string) => ({
  symbol,
  name: `${symbol} PLC`,
  sector: null,
  board: null,
  close: 10,
  prevClose: null,
  changePercent: null,
  volume: 1,
  tradeDate,
});

describe("runNgxHistoryBackfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistNgxQuotes.mockImplementation(async (_db, quotes) => quotes.length);
    loadNgxCover.mockResolvedValue({
      ok: true,
      warnings: [],
      snapshot: { printDate: "2026-10-22", asi: {}, indices: [] },
    });
  });

  it("ne crée ni ne renomme de société : tickers inconnus ignorés et comptés", async () => {
    loadNgxEquities.mockResolvedValue({
      ok: true,
      kind: "official-list",
      date: "2026-10-22",
      warnings: [],
      quotes: [quote("DANGCEM", "2026-10-22"), quote("UBA", "2026-10-22"), quote("GHOST", "2026-10-22"), quote("OLDCO", "2026-10-22")],
    });
    const db = fakeDb();
    const summary = await runNgxHistoryBackfill({
      db,
      from: "2026-10-22",
      to: "2026-10-22",
      charts: false,
      resume: false,
      logger: () => undefined,
    });
    expect(upsertNgxListings).not.toHaveBeenCalled();
    expect(summary.skippedUnknown).toBe(2);
    expect(summary.quotes).toBe(2);
    const [, sentQuotes, idMap] = persistNgxQuotes.mock.calls[0] as unknown as [unknown, { symbol: string }[], Map<string, string>];
    expect(sentQuotes.map((q) => q.symbol)).toEqual(["DANGCEM", "UBA"]);
    expect(idMap.get("DANGCEM")).toBe("c-dangcem");
    expect(summary.indices).toBe(20);
  });

  it("la séance JSON du jour garde la création / mise à jour des sociétés", async () => {
    upsertNgxListings.mockResolvedValue({ companyIdByTicker: new Map([["NEWCO", "c-new"]]), collisions: [], upserted: 1 });
    loadNgxEquities.mockResolvedValue({
      ok: true,
      kind: "json",
      date: "2026-10-22",
      warnings: [],
      quotes: [quote("NEWCO", "2026-10-22")],
    });
    const summary = await runNgxHistoryBackfill({
      db: fakeDb(),
      from: "2026-10-22",
      to: "2026-10-22",
      tryJson: true,
      now: new Date("2026-10-22T18:00:00.000Z"),
      charts: false,
      resume: false,
      logger: () => undefined,
    });
    expect(upsertNgxListings).toHaveBeenCalledTimes(1);
    expect(summary.skippedUnknown).toBe(0);
    expect(summary.quotes).toBe(1);
  });

  it("séance déjà en base : ne recharge que l'indice manquant", async () => {
    const db = fakeDb({ canonical: 146 });
    const summary = await runNgxHistoryBackfill({
      db,
      from: "2026-10-22",
      to: "2026-10-22",
      charts: false,
      resume: false,
      logger: () => undefined,
    });
    expect(loadNgxEquities).not.toHaveBeenCalled();
    expect(loadNgxCover).toHaveBeenCalledTimes(1);
    expect(summary.skippedCanonical).toBe(1);
    expect(summary.indices).toBe(20);
  });

  it("séance déjà en base avec ASI : rien à télécharger", async () => {
    const db = fakeDb({ canonical: 146, asiDates: ["2026-10-22"] });
    const summary = await runNgxHistoryBackfill({
      db,
      from: "2026-10-22",
      to: "2026-10-22",
      charts: false,
      resume: false,
      logger: () => undefined,
    });
    expect(loadNgxEquities).not.toHaveBeenCalled();
    expect(loadNgxCover).not.toHaveBeenCalled();
    expect(summary.processed).toBe(0);
  });

  it("s'arrête proprement avant le budget (reste < marge) et renvoie le curseur", async () => {
    const summary = await runNgxHistoryBackfill({
      db: fakeDb(),
      from: "2026-10-19",
      to: "2026-10-23",
      budgetMs: 20_000,
      charts: false,
      resume: false,
      logger: () => undefined,
    });
    expect(loadNgxEquities).not.toHaveBeenCalled();
    expect(summary.processed).toBe(0);
    expect(summary.incomplete).toBe(true);
    expect(summary.next).toBe("2026-10-19");
  });
  it("rattache un ancien code (FBNH) au ticker courant sans créer de société", async () => {
    loadNgxEquities.mockResolvedValue({
      ok: true,
      kind: "official-list",
      date: "2024-05-02",
      warnings: [],
      quotes: [quote("FBNH", "2024-05-02"), quote("UBA", "2024-05-02")],
    });
    const summary = await runNgxHistoryBackfill({
      db: fakeDb(),
      from: "2024-05-02",
      to: "2024-05-02",
      charts: false,
      indices: false,
      resume: false,
      logger: () => undefined,
    });
    const [, sent] = persistNgxQuotes.mock.calls[0] as unknown as [unknown, { symbol: string }[]];
    expect(sent.map((q) => q.symbol).sort()).toEqual(["FIRSTHOLDCO", "UBA"]);
    expect(summary.aliasRemapped).toBe(1);
    expect(summary.skippedUnknown).toBe(0);
  });

  it("refill : retraite une séance déjà complète mais n'écrit que les cours manquants des tickers visés", async () => {
    loadNgxEquities.mockResolvedValue({
      ok: true,
      kind: "official-list",
      date: "2024-05-02",
      warnings: [],
      quotes: [quote("FBNH", "2024-05-02"), quote("UBA", "2024-05-02"), quote("DANGCEM", "2024-05-02")],
    });
    const db = fakeDb({ canonical: 120 });
    const summary = await runNgxHistoryBackfill({
      db,
      from: "2024-05-02",
      to: "2024-05-02",
      refill: true,
      charts: false,
      resume: false,
      logger: () => undefined,
    });
    expect(loadNgxEquities).toHaveBeenCalledTimes(1);
    const [, sent] = persistNgxQuotes.mock.calls[0] as unknown as [unknown, { symbol: string }[]];
    expect(sent.map((q) => q.symbol)).toEqual(["FIRSTHOLDCO"]);
    expect(summary.indices).toBe(0);
    expect(loadNgxCover).not.toHaveBeenCalled();
  });

  it("refill : ne réécrit pas un cours déjà présent", async () => {
    loadNgxEquities.mockResolvedValue({
      ok: true,
      kind: "official-list",
      date: "2024-05-02",
      warnings: [],
      quotes: [quote("FBNH", "2024-05-02")],
    });
    await runNgxHistoryBackfill({
      db: fakeDb({ existing: [{ companyId: "c-fh", date: "2024-05-02" }] }),
      from: "2024-05-02",
      to: "2024-05-02",
      refill: true,
      charts: false,
      resume: false,
      logger: () => undefined,
    });
    const [, sent] = persistNgxQuotes.mock.calls[0] as unknown as [unknown, unknown[]];
    expect(sent).toHaveLength(0);
  });

  it("refill : va chercher le Daily Summary pour un titre absent de la liste officielle (ZICHIS)", async () => {
    loadNgxEquities.mockResolvedValue({
      ok: true,
      kind: "official-list",
      date: "2026-03-03",
      warnings: [],
      quotes: [quote("UBA", "2026-03-03")],
    });
    loadNgxSummaryQuotes.mockResolvedValue({ quotes: [quote("ZICHIS", "2026-03-03"), quote("OTHER", "2026-03-03")] });
    await runNgxHistoryBackfill({
      db: fakeDb(),
      from: "2026-03-03",
      to: "2026-03-03",
      refill: true,
      charts: false,
      resume: false,
      logger: () => undefined,
    });
    expect(loadNgxSummaryQuotes).toHaveBeenCalledTimes(1);
    const [, sent] = persistNgxQuotes.mock.calls[0] as unknown as [unknown, { symbol: string }[]];
    expect(sent.map((q) => q.symbol)).toEqual(["ZICHIS"]);
  });
});
