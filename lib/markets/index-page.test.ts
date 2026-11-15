import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/api/market-indices", () => ({ detailFromBundle: vi.fn() }));
vi.mock("@/lib/markets/ngx-browse", () => ({ loadNgxOverview: vi.fn() }));

import { analysisWindow, INDEX_ANALYSIS_DAYS, ngxBreadthScope } from "@/lib/markets/index-page";
import { composedIndexSeriesSql, INDEX_DAILY_DAYS } from "@/lib/markets/index-sheet";
import type { ConstituentMove } from "@/lib/markets/index-sheet";

const m = (ticker: string, sector: string, board: string | null = null): ConstituentMove => ({
  ticker,
  name: ticker,
  sector,
  board,
  close: 1,
  changePercent: 1,
  sessionDate: "2026-11-13",
});

describe("analysisWindow", () => {
  it("reste dans la partie quotidienne de la série composée", () => {
    expect(INDEX_ANALYSIS_DAYS).toBeLessThanOrEqual(INDEX_DAILY_DAYS);
    const pts = [
      { time: "2020-01-31", value: 1 },
      { time: "2024-09-20", value: 2 },
      { time: "2024-09-21", value: 3 },
      { time: "2026-11-13", value: 4 },
    ];
    expect(analysisWindow(pts).map((p) => p.time)).toEqual(["2024-09-20", "2024-09-21", "2026-11-13"]);
    expect(analysisWindow([])).toEqual([]);
  });
});

describe("ngxBreadthScope", () => {
  const moves = [m("GTCO", "banking"), m("ZENITHBANK", "banking"), m("AIICO", "financial-services"), m("DANGCEM", "industrial-goods", "Premium Board"), m("MTNN", "ict", "Main Board")];
  it("ASI = toutes les valeurs", () => {
    expect(ngxBreadthScope("NGX_ASI", moves)).toMatchObject({ basis: "universe" });
    expect(ngxBreadthScope("NGX_ASI", moves)!.moves).toHaveLength(5);
  });
  it("indices sectoriels et compartiments", () => {
    expect(ngxBreadthScope("NGXBNK", moves)!.moves.map((x) => x.ticker)).toEqual(["GTCO", "ZENITHBANK"]);
    expect(ngxBreadthScope("NGXINS", moves)!.moves.map((x) => x.ticker)).toEqual(["AIICO"]);
    expect(ngxBreadthScope("NGXPREMIUM", moves)).toMatchObject({ basis: "board", moves: [expect.objectContaining({ ticker: "DANGCEM" })] });
    expect(ngxBreadthScope("NGXMAINBOARD", moves)!.moves.map((x) => x.ticker)).toEqual(["MTNN"]);
  });
  it("N/D pour les indices sans périmètre connu", () => {
    expect(ngxBreadthScope("NGX30", moves)).toBeNull();
    expect(ngxBreadthScope("NGXOILGAS", moves)).toBeNull();
  });
});

describe("composedIndexSeriesSql", () => {
  it("ne lit qu'un indice, deux colonnes, avec buckets hebdo / mensuels", () => {
    const sql = composedIndexSeriesSql("idx_1");
    expect(sql.values).toContain("idx_1");
    expect(sql.sql).toContain("DISTINCT ON (bucket) date, value");
    expect(sql.sql).toContain("date_trunc('week', date)");
    expect(sql.sql).toContain("date_trunc('month', date)");
    expect(sql.sql).not.toMatch(/SELECT \*/);
  });
});
