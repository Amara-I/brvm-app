import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const auth = vi.hoisted(() => ({ user: { id: "test-user" } as { id: string } | null }));
vi.mock("@/lib/auth/get-current-user", () => ({
  getCurrentUser: async () => auth.user,
  getCurrentUserId: async () => auth.user?.id ?? null,
}));
const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), prices: vi.fn(), dividends: vi.fn(), ratios: vi.fn(),
  levels: vi.fn(), search: vi.fn(), catalog: vi.fn(), actions: vi.fn(), raw: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: mocks.raw, company: { findMany: mocks.findMany, findFirst: mocks.findFirst, count: mocks.count },
  priceHistory: { findMany: mocks.prices }, dividend: { findMany: mocks.dividends }, financialRatio: { findMany: mocks.ratios } } }));
vi.mock("@/lib/api/market-summary-snapshot", () => ({ loadRecentIndexLevels: mocks.levels }));
vi.mock("@/lib/api/listing-search-index", () => ({ getListingSearchIndex: mocks.search }));
vi.mock("@/lib/search/catalog", () => ({ getSiteSearchCatalog: mocks.catalog }));
vi.mock("@/lib/corporate-actions/load", () => ({ actionsForTicker: async () => [], actionsByTicker: async () => new Map() }));
vi.mock("@/lib/api/latest-data", () => ({ getLatestCanonicalPrices: async () => new Map(), getLatestFinancialRatios: async () => new Map() }));
import { GET as summary } from "@/app/api/market/summary/route";
import { GET as company } from "@/app/api/companies/[ticker]/route";
import { GET as companies } from "@/app/api/companies/route";
import { GET as search } from "@/app/api/search/route";
import { stockDocument } from "@/lib/search/documents";
import { GET as excel } from "@/app/api/export/excel/route";
import * as XLSX from "xlsx";
const req = (path: string) => new NextRequest(`https://example.org${path}`);
beforeEach(() => {
  auth.user = { id: "test-user" };
  vi.resetAllMocks();
  mocks.findMany.mockResolvedValue([]); mocks.count.mockResolvedValue(0);
  mocks.prices.mockResolvedValue([]); mocks.dividends.mockResolvedValue([]); mocks.ratios.mockResolvedValue([]);
  mocks.levels.mockResolvedValue([]); mocks.search.mockResolvedValue([]); mocks.catalog.mockResolvedValue([]);
  mocks.raw.mockResolvedValue([]);
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
    mocks.catalog.mockResolvedValue([
      stockDocument({ ticker: "MTNN", name: "MTN Nigeria", sector: "Telecom", exchange: "NGX" }),
      stockDocument({ ticker: "SNTS", name: "Sonatel", sector: "Télécoms", exchange: "BRVM" }),
    ]);
    const result = await search(req("/api/search?q=mtn&exchange=NGX"));
    const body = await result.json();
    const stocks = body.data.groups.filter((group: { kind: string }) => group.kind === "stock");
    expect(stocks).toHaveLength(1);
    expect(stocks[0].exchange).toBe("NGX");
    expect(stocks[0].items[0].href).toBe("/marches/ngx/actions/MTNN");
    expect((await search(req("/api/search?exchange=***"))).status).toBe(422);
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
    mocks.raw.mockResolvedValue([{ id: "p1" }]);
    mocks.prices.mockResolvedValue([{ companyId: "ngx", date: new Date("2026-10-30"), closePrice: 200, source: "NGX_OFFICIEL", ingestedAt: new Date("2026-10-30T17:00:00Z") }]);
    const response = await excel(req("/api/export/excel"));
    expect(response.status).toBe(200);
    const book = XLSX.read(Buffer.from(await response.arrayBuffer()), { type: "buffer" });
    const ngx = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets["Données NGX"]);
    expect(ngx[0].Devise).toBe("NGN");
    expect(XLSX.utils.sheet_to_json(book.Sheets["Données BRVM"])).toHaveLength(0);
  });

  it("refuse l'export Excel au visiteur sans compte", async () => {
    auth.user = null;
    const response = await excel(req("/api/export/excel"));
    expect(response.status).toBe(401);
  });

  it("limite l'historique du visiteur à cinq ans, au dernier dividende et au dernier exercice", async () => {
    auth.user = null;
    mocks.findFirst.mockResolvedValue({
      id: "c1", ticker: "SNTS", name: "Sonatel", exchange: "BRVM", currency: "XOF",
      isin: null, color: null, logoUrl: null, description: null, listedSince: null, isActive: true,
      country: { code: "SN", name: "Sénégal", flagEmoji: "🇸🇳" }, sector: { name: "Télécoms", slug: "telecoms" },
    });
    mocks.prices.mockResolvedValue([
      { date: new Date("2018-01-02T00:00:00Z"), closePrice: 100, volume: null, source: "BRVM_OFFICIEL", ingestedAt: new Date("2018-01-02T17:00:00Z") },
      { date: new Date("2023-06-01T00:00:00Z"), closePrice: 160, volume: null, source: "BRVM_OFFICIEL", ingestedAt: new Date("2023-06-01T17:00:00Z") },
      { date: new Date("2026-06-01T00:00:00Z"), closePrice: 200, volume: null, source: "BRVM_OFFICIEL", ingestedAt: new Date("2026-06-01T17:00:00Z") },
      { date: new Date("2026-11-20T00:00:00Z"), closePrice: 210, volume: null, source: "BRVM_OFFICIEL", ingestedAt: new Date("2026-11-20T17:00:00Z") },
    ]);
    mocks.dividends.mockResolvedValue([
      { year: 2020, amount: 100, exDate: new Date("2020-07-01"), paymentDate: null, source: "BRVM_OFFICIEL", createdAt: new Date() },
      { year: 2025, amount: 200, exDate: new Date("2025-07-01"), paymentDate: null, source: "BRVM_OFFICIEL", createdAt: new Date() },
    ]);
    mocks.ratios.mockResolvedValue([
      { year: 2020, per: 8, mktCap: 1, roe: 1, netMargin: 1, debtRatio: 1, pbRatio: 1, revenueGrowth: 1, fcf: 1, revenue: 1, operatingIncome: 1, netIncome: 1, createdAt: new Date(), source: "BRVM_OFFICIEL" },
      { year: 2025, per: 10, mktCap: 2, roe: 2, netMargin: 2, debtRatio: 2, pbRatio: 2, revenueGrowth: 2, fcf: 2, revenue: 2, operatingIncome: 2, netIncome: 2, createdAt: new Date(), source: "BRVM_OFFICIEL" },
    ]);
    const response = await company(req("/api/companies/SNTS?exchange=BRVM"), { params: { ticker: "SNTS" } });
    const body = await response.json();
    expect(body.data.priceHistory.map((row: { date: string }) => row.date)).toEqual(["2023-06-01", "2026-06-01", "2026-11-20"]);
    expect(body.data.dividends).toHaveLength(1);
    expect(body.data.dividends[0].year).toBe(2025);
    expect(body.data.financialRatios).toHaveLength(1);
    expect(body.data.financialRatios[0].year).toBe(2025);
    expect(response.headers.get("cache-control")).toMatch(/private/);
  });

  it("laisse l'historique complet à un compte connecté", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "c1", ticker: "SNTS", name: "Sonatel", exchange: "BRVM", currency: "XOF",
      isin: null, color: null, logoUrl: null, description: null, listedSince: null, isActive: true,
      country: { code: "SN", name: "Sénégal", flagEmoji: "🇸🇳" }, sector: { name: "Télécoms", slug: "telecoms" },
    });
    mocks.prices.mockResolvedValue([
      { date: new Date("2018-01-02T00:00:00Z"), closePrice: 100, volume: null, source: "BRVM_OFFICIEL", ingestedAt: new Date("2018-01-02T17:00:00Z") },
      { date: new Date("2026-11-20T00:00:00Z"), closePrice: 210, volume: null, source: "BRVM_OFFICIEL", ingestedAt: new Date("2026-11-20T17:00:00Z") },
    ]);
    const body = await (await company(req("/api/companies/SNTS?exchange=BRVM"), { params: { ticker: "SNTS" } })).json();
    expect(body.data.priceHistory).toHaveLength(2);
    expect(body.data.priceHistory[0].date).toBe("2018-01-02");
  });
});
