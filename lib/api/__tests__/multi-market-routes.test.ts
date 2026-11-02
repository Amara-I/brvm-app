import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), prices: vi.fn(), dividends: vi.fn(), ratios: vi.fn(),
  levels: vi.fn(), search: vi.fn(), actions: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { company: { findMany: mocks.findMany, findFirst: mocks.findFirst, count: mocks.count },
  priceHistory: { findMany: mocks.prices }, dividend: { findMany: mocks.dividends }, financialRatio: { findMany: mocks.ratios } } }));
vi.mock("@/lib/api/market-summary-snapshot", () => ({ loadRecentIndexLevels: mocks.levels }));
vi.mock("@/lib/api/listing-search-index", () => ({ getListingSearchIndex: mocks.search }));
vi.mock("@/lib/corporate-actions/load", () => ({ actionsForTicker: async () => [], actionsByTicker: async () => new Map() }));
vi.mock("@/lib/api/latest-data", () => ({ getLatestCanonicalPrices: async () => new Map(), getLatestFinancialRatios: async () => new Map() }));
import { GET as summary } from "@/app/api/market/summary/route";
import { GET as company } from "@/app/api/companies/[ticker]/route";
import { GET as companies } from "@/app/api/companies/route";
import { GET as search } from "@/app/api/search/route";
import { GET as excel } from "@/app/api/export/excel/route";
import * as XLSX from "xlsx";
const req = (path: string) => new NextRequest(`https://example.org${path}`);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.findMany.mockResolvedValue([]); mocks.count.mockResolvedValue(0);
  mocks.prices.mockResolvedValue([]); mocks.dividends.mockResolvedValue([]); mocks.ratios.mockResolvedValue([]);
  mocks.levels.mockResolvedValue([]); mocks.search.mockResolvedValue([]);
});
describe("contrats API multi-marchés (Prisma simulé, pas une certification de la base)", () => {
  it.each(["BRVM", "NGX"])("isole résumé, liste/screener et fiche %s", async (exchange) => {
    mocks.levels.mockResolvedValue([{ code: exchange === "NGX" ? "NGX_ASI" : "BRVM_COMPOSITE", value: 100 }]);
    const result = await summary(req(`/api/market/summary?exchange=${exchange}`));
    expect((await result.json()).data.headlineIndices).toHaveLength(1);
    expect(mocks.levels).toHaveBeenCalledWith(exchange);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true, exchange } }));
    await companies(req(`/api/companies?exchange=${exchange}`));
    expect(mocks.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { isActive: true, exchange } }));
    mocks.findFirst.mockResolvedValue(null);
    expect((await company(req(`/api/companies/TEST?exchange=${exchange}`), { params: { ticker: "test" } })).status).toBe(404);
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { ticker: "TEST", exchange } }));
  });
  it("conserve BRVM par défaut et refuse une place invalide avant toute lecture", async () => {
    await summary(req("/api/market/summary"));
    expect(mocks.levels).toHaveBeenCalledWith("BRVM");
    mocks.levels.mockClear();
    expect((await summary(req("/api/market/summary?exchange=FAUX"))).status).toBe(422);
    expect(mocks.levels).not.toHaveBeenCalled();
  });
  it("recherche NGX et renvoie le bon lien, sans faux résultat BRVM", async () => {
    mocks.search.mockResolvedValue([{ ticker: "MTNN", name: "MTN Nigeria", sector: "Telecom", exchange: "NGX" }]);
    const result = await search(req("/api/search?q=mtn&exchange=NGX"));
    const body = await result.json();
    expect(body.data.groups).toHaveLength(1);
    expect(body.data.groups[0].items[0].href).toBe("/marches/ngx/actions/MTNN");
    expect((await search(req("/api/search?exchange=TOUT"))).status).toBe(422);
  });
  it("renvoie les unités et l’horodatage du cours NGX", async () => {
    mocks.findFirst.mockResolvedValue({ id: "ngx", ticker: "MTNN", name: "MTN", exchange: "NGX", currency: "NGN",
      country: { code: "NG", name: "Nigeria" }, sector: { name: "Telecom", slug: "telecom" } });
    mocks.prices.mockResolvedValue([{ date: new Date("2026-10-30"), closePrice: 200, volume: null, source: "NGX_OFFICIEL", ingestedAt: new Date("2026-10-30T17:00:00Z") }]);
    const body = await (await company(req("/api/companies/MTNN?exchange=NGX"), { params: { ticker: "MTNN" } })).json();
    expect(body.data.company.currency).toBe("NGN");
    expect(body.data.priceHistory[0].ingestedAt).toBe("2026-10-30T17:00:00.000Z");
  });
  it("exporte un univers NGX seul sans le présenter en FCFA", async () => {
    mocks.findMany.mockResolvedValue([{ id: "ngx", ticker: "MTNN", name: "MTN", exchange: "NGX", country: { name: "Nigeria" }, sector: { name: "Telecom" } }]);
    mocks.prices.mockResolvedValue([{ companyId: "ngx", date: new Date("2026-10-30"), closePrice: 200, source: "NGX_OFFICIEL", ingestedAt: new Date("2026-10-30T17:00:00Z") }]);
    const response = await excel(req("/api/export/excel"));
    expect(response.status).toBe(200);
    const book = XLSX.read(Buffer.from(await response.arrayBuffer()), { type: "buffer" });
    const ngx = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets["Données NGX"]);
    expect(ngx[0].Devise).toBe("NGN");
    expect(XLSX.utils.sheet_to_json(book.Sheets["Données BRVM"])).toHaveLength(0);
  });
});
