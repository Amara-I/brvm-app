import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
const dataset = vi.hoisted(() => ({
  current: {
    years: [2023, 2024, 2025],
    generatedAt: "2026-11-20T18:00:00.000Z",
    companies: [
      {
        ticker: "SNTS",
        name: "Sonatel",
        country: "Sénégal",
        countryFlag: "🇸🇳",
        sector: "Télécoms",
        per: 12.5,
        mktcap: 2500,
        roe: 22,
        netMargin: 18,
        debtRatio: 30,
        pbRatio: 2.1,
        revenueGrowth: 8,
        fcf: 120,
        prevPer: 11,
        prevMktcap: 2000,
        prevRoe: 20,
        prevNetMargin: 16,
        prevDebtRatio: 28,
        prevPbRatio: 1.9,
        prevRevenueGrowth: 7,
        prevFcf: 100,
        prices: { 2023: 14000, 2024: 15000, 2025: 16000 },
        dividends: { 2023: 400, 2024: 450, 2025: 500 },
        priceAsOf: "2025-11-20",
        color: "#d4a017",
        dataSource: "BRVM_OFFICIEL",
        lastSyncedAt: "2025-11-20T18:00:00.000Z",
      },
    ],
  },
}));

vi.mock("@/lib/auth/get-current-user", () => ({
  getCurrentUser: async () => auth.user,
  getCurrentUserId: async () => auth.user?.id ?? null,
}));

vi.mock("@/lib/api/companies-full-dataset", () => ({
  getCompaniesFullDataset: async () => dataset.current,
}));

vi.mock("@/lib/api/company-sheet-dataset", () => ({
  getCompanySheetPayload: async () => ({
    company: dataset.current.companies[0],
    metrics: {
      score: 81,
      signal: { label: "ACHAT", color: "#00aa00" },
      confidence: "Élevée",
      compositeScore: 81,
      signalSummary: "achat",
      signalReasons: [],
      horizonScores: { court: 1, moyen: 1, long: 1 },
      technicalScore: 1,
      fundamentalScore: 1,
      sectorScore: 1,
      riskAnalysis: { riskScore: 20 },
      technical: { available: true },
      riskLevel: "Faible",
      volatilityPercent: "10",
      perf5Percent: "80",
      perf10Percent: "120",
      dividendYieldPercent: "4",
      avgDividend: 400,
      currentPrice: 16000,
      currentDividend: 500,
      historyDepth: 10,
    },
    health: { overall: 8, label: "Solide", pillars: [], note: "" },
  }),
}));

import { GET as full } from "@/app/api/companies/full/route";
import { GET as analyse } from "@/app/api/companies/[ticker]/analyse/route";

const req = (path: string) => new NextRequest(`https://example.org${path}`);

beforeEach(() => {
  auth.user = null;
});

describe("GET /api/companies/full", () => {
  it("allège le jeu pour un visiteur et met un cache privé", async () => {
    const response = await full();
    const body = await response.json();
    expect(body.data.companies[0].per).toBe(0);
    expect(body.data.companies[0].prices).toEqual({ 2025: 16000 });
    expect(body.data.companies[0].dividends).toEqual({ 2025: 500 });
    expect(body.data.companies[0].roe).toBeNull();
    expect(response.headers.get("cache-control")).toMatch(/private/);
  });

  it("laisse les ratios et l'historique à un compte connecté", async () => {
    auth.user = { id: "u1" };
    const response = await full();
    const body = await response.json();
    expect(body.data.companies[0].per).toBe(12.5);
    expect(body.data.companies[0].prices).toEqual({ 2023: 14000, 2024: 15000, 2025: 16000 });
  });
});

describe("GET /api/companies/:ticker/analyse", () => {
  it("répond 401 au visiteur", async () => {
    const response = await analyse(req("/api/companies/SNTS/analyse"), { params: { ticker: "SNTS" } });
    expect(response.status).toBe(401);
  });

  it("renvoie le score à un compte connecté", async () => {
    auth.user = { id: "u1" };
    const response = await analyse(req("/api/companies/SNTS/analyse"), { params: { ticker: "SNTS" } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.score).toBe(81);
    expect(body.data.signal.label).toBe("ACHAT");
    expect(response.headers.get("cache-control")).toMatch(/private/);
  });
});
