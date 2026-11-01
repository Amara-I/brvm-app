import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { appendPrices, appendPublications, priceInsertPlan, type Publication } from "./persist";
import type { RawPriceQuote } from "../types";
const q = (ticker = "SNTS", price = 100, date = "2020-01-02"): RawPriceQuote => ({ ticker, closePrice: price, date, source: "SIKAFINANCE", volume: null, fetchedAt: "2026-11-01T00:00:00Z" });
const ids = new Map([["SNTS", "c1"]]);
describe("conservation stricte", () => {
  it("ne remplace ni prix ni canonique existant, mais ajoute une nouvelle source comme candidate", () => {
    const old = [{ companyId: "c1", date: new Date("2020-01-02"), source: "BRVM_OFFICIEL", closePrice: 90, isCanonical: true }];
    const before = JSON.stringify(old);
    const plan = priceInsertPlan([q(), q()], old, ids);
    expect(plan.data).toHaveLength(1);
    expect(plan.data[0].isCanonical).toBe(false);
    expect(plan.conflicts.length).toBeGreaterThan(0);
    expect(JSON.stringify(old)).toBe(before);
  });
  it("est idempotent pour la même source et journalise un conflit sans la réécrire", () => {
    const plan = priceInsertPlan([q("SNTS", 110)], [{ companyId: "c1", date: new Date("2020-01-02"), source: "SIKAFINANCE", closePrice: 100, isCanonical: true }], ids);
    expect(plan.data).toHaveLength(0);
    expect(plan.conflicts[0].deltaPercent).toBe(10);
  });
  it("ajoute les trous uniquement, filtre ticker inconnu et valeurs invalides", () => {
    const result = priceInsertPlan([q(), q(), q("AUTRE"), q("SNTS", NaN), q("SNTS", -1)], [], ids);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].isCanonical).toBe(true);
  });
  it("préfère l’officiel quand plusieurs candidats couvrent une nouvelle date", () => {
    const plan = priceInsertPlan([q(), { ...q(), source: "BRVM_OFFICIEL", closePrice: 99 }], [], ids);
    expect(plan.data.filter((r) => r.isCanonical)).toHaveLength(1);
    expect(plan.data[0].source).toBe("BRVM_OFFICIEL");
  });
  it("ne prend aucun verrou d’écriture et n’insère rien en simulation", async () => {
    const tx = { $executeRawUnsafe: vi.fn(), priceHistory: { findMany: vi.fn(async () => []), createMany: vi.fn() } };
    const db = { $transaction: async (fn: (arg: typeof tx) => unknown) => fn(tx) } as unknown as PrismaClient;
    const result = await appendPrices(db, [q()], ids, false);
    expect(result.candidates).toBe(1); expect(result.inserted).toBe(0);
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled(); expect(tx.priceHistory.createMany).not.toHaveBeenCalled();
  });
  it("insère les nouveaux prix sous verrou, sans update ni delete", async () => {
    const tx = { $executeRawUnsafe: vi.fn(), priceHistory: { findMany: vi.fn(async () => []), createMany: vi.fn(async () => ({ count: 1 })) } };
    const db = { $transaction: async (fn: (arg: typeof tx) => unknown) => fn(tx) } as unknown as PrismaClient;
    expect((await appendPrices(db, [q()], ids, true)).inserted).toBe(1);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining("LOCK TABLE"));
    expect(tx.priceHistory.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });
});
const publication: Publication = { ticker: "SNTS", exchange: "BRVM", url: "https://www.brvm.org/rapport.pdf", title: "Rapport 2025", publishedAt: null,
  sourceName: "BRVM officiel", docType: "RAPPORT", periodLabel: "2025" };
it("n’invente aucune date d’actualité pour un rapport non daté", async () => {
  const db = { companyDocument: { findUnique: vi.fn(async () => null), createMany: vi.fn(async () => ({ count: 1 })) },
    newsArticle: { findFirst: vi.fn(), createMany: vi.fn() } };
  const result = await appendPublications(db as unknown as PrismaClient, [publication], ids, true);
  expect(result.documents).toBe(1); expect(result.undated).toBe(1);
  expect(db.newsArticle.createMany).not.toHaveBeenCalled();
});
it("ne réécrit aucun document ou article déjà présent", async () => {
  const db = { companyDocument: { findUnique: vi.fn(async () => ({ id: "old" })), createMany: vi.fn() },
    newsArticle: { findFirst: vi.fn(async () => ({ id: "old" })), createMany: vi.fn() } };
  await appendPublications(db as unknown as PrismaClient, [{ ...publication, publishedAt: "2026-02-01" }], ids, true);
  expect(db.companyDocument.createMany).not.toHaveBeenCalled(); expect(db.newsArticle.createMany).not.toHaveBeenCalled();
});
