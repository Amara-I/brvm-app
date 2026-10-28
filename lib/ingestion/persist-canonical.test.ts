import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { canonicalSourceForDay } from "./reconciliation";
import {
  loadPreviousCanonicalCloses,
  markCanonicalPriceRows,
  persistPriceQuotes,
  pickCanonicalWinners,
} from "./persist";
import type { DataSourceCode, RawPriceQuote } from "./types";

describe("pickCanonicalWinners", () => {
  it("applique la priorité BRVM_OFFICIEL > SIKAFINANCE > RICHBOURSE", () => {
    const winners = pickCanonicalWinners(
      [
        { companyId: "c1", date: "2026-10-27" },
        { companyId: "c2", date: "2026-10-27" },
        { companyId: "c3", date: "2026-10-27" },
      ],
      [
        { companyId: "c1", date: "2026-10-27", source: "RICHBOURSE" },
        { companyId: "c1", date: "2026-10-27", source: "BRVM_OFFICIEL" },
        { companyId: "c1", date: "2026-10-27", source: "SIKAFINANCE" },
        { companyId: "c2", date: "2026-10-27", source: "RICHBOURSE" },
        { companyId: "c2", date: "2026-10-27", source: "SIKAFINANCE" },
        { companyId: "c3", date: "2026-10-27", source: "OUESTBOURSE" },
        { companyId: "c3", date: "2026-10-27", source: "RICHBOURSE" },
        // autre jour, ignoré
        { companyId: "c1", date: "2026-10-26", source: "MANUEL" },
      ]
    );
    expect(winners).toEqual([
      { companyId: "c1", date: "2026-10-27", source: "BRVM_OFFICIEL" },
      { companyId: "c2", date: "2026-10-27", source: "SIKAFINANCE" },
      { companyId: "c3", date: "2026-10-27", source: "OUESTBOURSE" },
    ]);
  });

  it("donne le même gagnant que canonicalSourceForDay pour toute combinaison", () => {
    const all: DataSourceCode[] = ["BRVM_OFFICIEL", "NGX_OFFICIEL", "SIKAFINANCE", "OUESTBOURSE", "RICHBOURSE", "MANUEL"];
    for (let mask = 1; mask < 1 << all.length; mask++) {
      const sources = all.filter((_, i) => mask & (1 << i));
      const [winner] = pickCanonicalWinners(
        [{ companyId: "c", date: "2026-01-02" }],
        sources.map((source) => ({ companyId: "c", date: "2026-01-02", source }))
      );
      expect(winner?.source).toBe(canonicalSourceForDay(sources));
    }
  });

  it("ne retient rien quand aucune ligne n'existe", () => {
    expect(pickCanonicalWinners([{ companyId: "c", date: "2026-01-02" }], [])).toEqual([]);
  });

  it("dédoublonne les paires", () => {
    const winners = pickCanonicalWinners(
      [
        { companyId: "c", date: "2026-01-02" },
        { companyId: "c", date: "2026-01-02" },
      ],
      [{ companyId: "c", date: "2026-01-02", source: "BRVM_OFFICIEL" }]
    );
    expect(winners).toHaveLength(1);
  });
});

function fakeDb(existing: Array<{ companyId: string; date: string; source: string }> = []) {
  const queryRaw = vi.fn(async () => existing);
  const executeRaw = vi.fn(async () => 1);
  const db = { $queryRaw: queryRaw, $executeRaw: executeRaw } as unknown as PrismaClient;
  return { db, queryRaw, executeRaw };
}

describe("markCanonicalPriceRows", () => {
  it("fait 1 lecture + 1 UPDATE pour 146 tickers (au lieu de ~4 requêtes par ticker)", async () => {
    const pairs = Array.from({ length: 146 }, (_, i) => ({ companyId: `c${i}`, date: "2026-10-27" }));
    const existing = pairs.map((p) => ({ ...p, source: "NGX_OFFICIEL" }));
    const { db, queryRaw, executeRaw } = fakeDb(existing);
    const n = await markCanonicalPriceRows(db, pairs);
    expect(n).toBe(146);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it("passe la source gagnante dans l'UPDATE", async () => {
    const { db, executeRaw } = fakeDb([
      { companyId: "c1", date: "2026-10-27", source: "RICHBOURSE" },
      { companyId: "c1", date: "2026-10-27", source: "BRVM_OFFICIEL" },
    ]);
    await markCanonicalPriceRows(db, [{ companyId: "c1", date: "2026-10-27" }]);
    const [, ...args] = executeRaw.mock.calls[0] as unknown as unknown[];
    const values = args.flatMap((arg) => (arg as { values?: unknown[] }).values ?? []);
    expect(values).toContain("BRVM_OFFICIEL");
    expect(values).not.toContain("RICHBOURSE");
  });

  it("n'exécute pas d'UPDATE sans lignes en base", async () => {
    const { db, executeRaw } = fakeDb([]);
    expect(await markCanonicalPriceRows(db, [{ companyId: "c1", date: "2026-10-27" }])).toBe(0);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("découpe en lots de 500 paires", async () => {
    const pairs = Array.from({ length: 1200 }, (_, i) => ({ companyId: `c${i}`, date: "2026-10-27" }));
    const { db, queryRaw } = fakeDb([]);
    await markCanonicalPriceRows(db, pairs);
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });
});

describe("loadPreviousCanonicalCloses", () => {
  it("une requête pour tous les tickers et rattache chaque cours à son ticker", async () => {
    const queryRaw = vi.fn(async () => [
      { companyId: "c1", date: "2026-10-26", closePrice: 10.5 },
      { companyId: "c2", date: "2026-10-23", closePrice: 20 },
    ]);
    const db = { $queryRaw: queryRaw } as unknown as PrismaClient;
    const map = await loadPreviousCanonicalCloses(db, [
      { ticker: "AAA", companyId: "c1", minDate: "2026-10-27" },
      { ticker: "BBB", companyId: "c2", minDate: "2026-10-27" },
      { ticker: "CCC", companyId: "c3", minDate: "2026-10-27" },
    ]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(map.get("AAA")).toEqual({ date: "2026-10-26", closePrice: 10.5 });
    expect(map.get("BBB")).toEqual({ date: "2026-10-23", closePrice: 20 });
    expect(map.has("CCC")).toBe(false);
  });
});

describe("persistPriceQuotes (NGX, 146 tickers)", () => {
  it("reste à quelques requêtes quel que soit le nombre de titres", async () => {
    const tickers = Array.from({ length: 146 }, (_, i) => `T${i}`);
    const companyIdByTicker = new Map(tickers.map((t, i) => [t, `c${i}`]));
    const quotes: RawPriceQuote[] = tickers.map((ticker) => ({
      ticker,
      closePrice: 10,
      volume: 100,
      source: "NGX_OFFICIEL",
      date: "2026-10-27",
      fetchedAt: "2026-10-27T18:00:00Z",
      changePercent: null,
      prevClose: null,
    }));
    const reconciled = quotes.map((q) => ({
      ticker: q.ticker,
      date: q.date,
      closePrice: q.closePrice,
      resolvedSource: "NGX_OFFICIEL" as const,
      candidates: [q],
    }));
    const existing = tickers.map((_, i) => ({ companyId: `c${i}`, date: "2026-10-27", source: "NGX_OFFICIEL" }));
    const queryRaw = vi.fn(async (strings: TemplateStringsArray) =>
      String(strings[0]).includes("LATERAL") || strings.join("").includes("LATERAL") ? [] : existing
    );
    const executeRaw = vi.fn(async () => 1);
    const db = { $queryRaw: queryRaw, $executeRaw: executeRaw } as unknown as PrismaClient;
    const result = await persistPriceQuotes(db, quotes, reconciled, companyIdByTicker);
    expect(result.upserted).toBe(146);
    expect(result.markedCanonical).toBe(146);
    // 1 INSERT groupé (≤ 400 lignes) + 1 UPDATE canonique ; 2 lectures (précédent + sources).
    expect(executeRaw.mock.calls.length).toBeLessThanOrEqual(2);
    expect(queryRaw.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
