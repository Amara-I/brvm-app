import { beforeEach, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
const m = vi.hoisted(() => ({ histos: vi.fn(), prices: vi.fn(), publications: vi.fn(), brvm: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("../connectors/sikafinance_connector", () => ({ sikafinanceConnector: { fetchHistos: m.histos } }));
vi.mock("./persist", () => ({ appendPrices: m.prices, appendPublications: m.publications }));
vi.mock("./publications", () => ({ collectBrvmPublications: m.brvm, collectNgxPublications: m.brvm }));
import { runAdditiveEnrichment } from "./run";
import { enrichmentSchema } from "./plan";
function db() {
  return { company: { findMany: vi.fn(async () => [{ id: "c1", ticker: "SNTS", name: "Sonatel", isin: "SN000" }]) },
    ingestionLog: { findMany: vi.fn(async () => []), create: vi.fn(async () => ({})) } };
}
beforeEach(() => { vi.resetAllMocks(); m.prices.mockResolvedValue({ inserted: 0, candidates: 1, conflicts: [] }); });
it("n’avance pas le curseur sur erreur source et ne journalise pas de faux succès en simulation", async () => {
  m.histos.mockResolvedValue({ ok: false, error: "HTTP 429" }); const store = db();
  const result = await runAdditiveEnrichment(enrichmentSchema.parse({ exchange: "BRVM", from: "2020-01-01", to: "2020-02-01" }), store as unknown as PrismaClient);
  expect(result.next).toBe(0); expect(result.failed).toBe(true);
  expect(store.ingestionLog.create).not.toHaveBeenCalled(); expect(m.prices).not.toHaveBeenCalled();
});
it("avance la reprise après une fenêtre réussie et réutilise les lignes du connecteur sans rééchantillonnage", async () => {
  const quote = { ticker: "SNTS", date: "2020-01-02", closePrice: 100 };
  m.histos.mockResolvedValue({ ok: true, data: [quote] }); const store = db();
  const result = await runAdditiveEnrichment(enrichmentSchema.parse({ exchange: "BRVM", from: "2020-01-01", to: "2020-02-01", limit: 1, apply: "1" }), store as unknown as PrismaClient);
  expect(result.next).toBe(1); expect(result.incomplete).toBe(true);
  expect(m.prices).toHaveBeenCalledWith(store, [quote], expect.any(Map), true);
  expect(store.ingestionLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ errors: expect.objectContaining({ next: 1, kind: "ADDITIVE_ENRICHMENT" }) }) }));
});
it("continue les publications avec un catalogue vide sans inventer de rapport", async () => {
  m.brvm.mockResolvedValue([]); m.publications.mockResolvedValue({ documents: 0, news: 0, candidates: 0 });
  const result = await runAdditiveEnrichment(enrichmentSchema.parse({ exchange: "BRVM", kind: "publications", limit: 1 }), db() as unknown as PrismaClient);
  expect(result.results[0].collected).toBe(0); expect(result.next).toBe(1);
});
