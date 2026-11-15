// Évaluation des alertes NGX (Prisma et chargeurs simulés — pas une certification de la base).
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  rules: vi.fn(),
  ruleUpdate: vi.fn(),
  companies: vi.fn(),
  prevPrice: vi.fn(),
  holdings: vi.fn(),
  prefRows: vi.fn(),
  indexFind: vi.fn(),
  indexValue: vi.fn(),
  eventFind: vi.fn(),
  latest: vi.fn(),
  priceEval: vi.fn(),
  emit: vi.fn(),
  flush: vi.fn(),
  prefs: vi.fn(),
  screener: vi.fn(),
  brvmDataset: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    alertRule: { findMany: m.rules, update: m.ruleUpdate },
    company: { findMany: m.companies },
    priceHistory: { findFirst: m.prevPrice },
    portfolioHolding: { findMany: m.holdings },
    notificationPreference: { findMany: m.prefRows },
    marketIndex: { findUnique: m.indexFind },
    marketIndexValue: { findFirst: m.indexValue },
    notificationEvent: { findFirst: m.eventFind },
  },
}));
vi.mock("@/lib/alerts/evaluate-price-alerts", () => ({ evaluateActivePriceAlerts: m.priceEval }));
vi.mock("@/lib/api/latest-data", () => ({ getLatestCanonicalPrices: m.latest }));
vi.mock("@/lib/notifications/emit", () => ({ emitNotification: m.emit, flushPendingNotificationEmails: m.flush }));
vi.mock("@/lib/notifications/prefs", () => ({ getPrefsMap: m.prefs }));
vi.mock("@/lib/markets/ngx-screener", () => ({ loadNgxScreener: m.screener }));
vi.mock("@/lib/api/companies-full-dataset", () => ({ loadCompaniesFullDataset: m.brvmDataset }));
vi.mock("@/lib/api/market-spark-series", () => ({ getMarketSparkSeriesByTicker: async () => ({}) }));
vi.mock("@/lib/calc/market-summary-stats", () => ({ allCompaniesWithMetrics: () => [] }));
vi.mock("@/lib/corporate-actions/load", () => ({ actionsForTicker: async () => [] }));

import { evaluateAllAlerts } from "./evaluate-all";
import { DEFAULT_PREFS } from "./types";

const NOW = new Date("2026-11-13T17:05:00.000Z"); // vendredi, après le cron de 17h UTC
const TODAY = "2026-11-13";

const MTNN = { id: "c-mtnn", ticker: "MTNN", exchange: "NGX" };
const SNTS = { id: "c-snts", ticker: "SNTS", exchange: "BRVM" };

function rule(over: Record<string, unknown>) {
  return {
    id: "r1",
    userId: "u1",
    enabled: true,
    ticker: null,
    companyId: null,
    indexCode: null,
    params: {},
    lastFireKey: null,
    lastFiredAt: null,
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  m.priceEval.mockResolvedValue({ checked: 0, triggered: 0, alertIds: [], fired: [] });
  m.rules.mockResolvedValue([]);
  m.companies.mockImplementation(async (args: { where: { exchange?: { in: string[] }; ticker?: { in: string[] } } }) =>
    [MTNN, SNTS].filter(
      (c) =>
        (!args.where.ticker || args.where.ticker.in.includes(c.ticker)) &&
        (!args.where.exchange || args.where.exchange.in.includes(c.exchange))
    )
  );
  m.latest.mockImplementation(async (ids: string[]) => {
    const rows = new Map<string, unknown>();
    if (ids.includes("c-mtnn"))
      rows.set("c-mtnn", { companyId: "c-mtnn", closePrice: 330.5, date: new Date("2026-11-13T00:00:00Z"), changePercent: 6.2 });
    if (ids.includes("c-snts"))
      rows.set("c-snts", { companyId: "c-snts", closePrice: 26000, date: new Date("2026-11-13T00:00:00Z"), changePercent: 7 });
    return rows;
  });
  m.prevPrice.mockImplementation(async (args: { where: { companyId: string } }) =>
    args.where.companyId === "c-mtnn"
      ? { closePrice: 311.2, date: new Date("2026-11-12T00:00:00Z") }
      : { closePrice: 24300, date: new Date("2026-11-12T00:00:00Z") }
  );
  m.holdings.mockResolvedValue([]);
  m.prefRows.mockResolvedValue([]);
  m.eventFind.mockResolvedValue(null);
  m.prefs.mockImplementation(async (ids: string[]) => new Map(ids.map((id) => [id, { ...DEFAULT_PREFS, signalEnabled: true, indexEnabled: true }])));
  m.emit.mockResolvedValue({ created: true, id: "ev1", emailed: false });
  m.flush.mockResolvedValue({ sent: 0, skipped: 0 });
});

describe("evaluateAllAlerts — NGX", () => {
  it("déclenche une variation du jour NGX en naira, sans toucher aux règles BRVM", async () => {
    m.rules.mockResolvedValue([
      rule({ id: "r-ngx", kind: "DAILY_MOVE", ticker: "MTNN", companyId: "c-mtnn", params: { percent: 5 } }),
      rule({ id: "r-brvm", kind: "DAILY_MOVE", ticker: "SNTS", companyId: "c-snts", params: { percent: 5 } }),
    ]);

    const summary = await evaluateAllAlerts({ exchanges: ["NGX"], now: NOW, skipEmailFlush: true });

    expect(m.priceEval).toHaveBeenCalledWith({ exchanges: ["NGX"] });
    // Derniers cours des seuls titres suivis, restreints à la NGX.
    expect(m.companies).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ exchange: { in: ["NGX"] }, ticker: { in: ["MTNN", "SNTS"] } }) })
    );
    expect(m.emit).toHaveBeenCalledTimes(1);
    const input = m.emit.mock.calls[0][0];
    expect(input).toMatchObject({ type: "PRIX", ticker: "MTNN", exchange: "NGX", alertRuleId: "r-ngx" });
    expect(input.title).toBe("MTNN : variation du jour +6,2 %");
    expect(input.body).toContain("₦330,50");
    expect(input.body).not.toContain("FCFA");
    expect(m.ruleUpdate).toHaveBeenCalledWith({
      where: { id: "r-ngx" },
      data: { lastFiredAt: NOW, lastFireKey: `${TODAY}:DAILY:MTNN:5` },
    });
    expect(summary.rules.triggered).toBe(1);
    // Portefeuille, indices phares BRVM, rappels et digest : réservés au cron.
    expect(m.holdings).toHaveBeenCalledTimes(1); // signaux uniquement (portefeuille BRVM ignoré)
    expect(m.prefRows).not.toHaveBeenCalled();
    expect(m.flush).not.toHaveBeenCalled();
  });

  it("anti-doublon : une règle NGX déjà déclenchée aujourd'hui ne renvoie rien", async () => {
    m.rules.mockResolvedValue([
      rule({
        id: "r-ngx",
        kind: "DAILY_MOVE",
        ticker: "MTNN",
        companyId: "c-mtnn",
        params: { percent: 5 },
        lastFireKey: `${TODAY}:DAILY:MTNN:5`,
      }),
    ]);
    await evaluateAllAlerts({ exchanges: ["NGX"], now: NOW, skipEmailFlush: true });
    expect(m.emit).not.toHaveBeenCalled();
    expect(m.ruleUpdate).not.toHaveBeenCalled();
  });

  it("variation d'indice NGX : lien vers /marches/ngx/indices, indices BRVM ignorés en passage NGX", async () => {
    m.rules.mockResolvedValue([
      rule({ id: "r-asi", kind: "INDEX_MOVE", indexCode: "NGX_ASI", params: { percent: 1 } }),
      rule({ id: "r-comp", userId: "u2", kind: "INDEX_MOVE", indexCode: "BRVM_COMPOSITE", params: { percent: 1 } }),
    ]);
    m.indexFind.mockImplementation(async (args: { where: { code: string } }) =>
      args.where.code === "NGX_ASI" ? { id: "i-asi", exchange: "NGX" } : { id: "i-comp", exchange: "BRVM" }
    );
    m.indexValue.mockResolvedValue({ value: 145230.12, changePercent: -1.8, date: new Date("2026-11-13T00:00:00Z") });

    await evaluateAllAlerts({ exchanges: ["NGX"], now: NOW, skipEmailFlush: true });

    expect(m.emit).toHaveBeenCalledTimes(1);
    expect(m.emit.mock.calls[0][0]).toMatchObject({
      type: "INDICES",
      indexCode: "NGX_ASI",
      exchange: "NGX",
      alertRuleId: "r-asi",
    });
    expect(m.emit.mock.calls[0][0].title).toBe("NGX_ASI : −1,8 %");
    expect(m.ruleUpdate).toHaveBeenCalledWith({
      where: { id: "r-asi" },
      data: { lastFiredAt: NOW, lastFireKey: `${TODAY}:INDEX:NGX_ASI` },
    });
  });

  it("signal NGX : ACHAT FORT du screener NGX → notification SIGNAUX vers la fiche NGX", async () => {
    m.rules.mockResolvedValue([
      rule({ id: "r-sig", kind: "SIGNAL_ENTRY", ticker: "MTNN", companyId: "c-mtnn", params: { signal: "ACHAT FORT" } }),
    ]);
    m.screener.mockResolvedValue({
      rows: [{ ticker: "MTNN", overall: 72, technical: { signal: { label: "ACHAT FORT" } } }],
    });

    const summary = await evaluateAllAlerts({ exchanges: ["NGX"], now: NOW, skipEmailFlush: true });

    expect(m.brvmDataset).not.toHaveBeenCalled();
    expect(summary.signals).toEqual({ checked: 1, triggered: 1 });
    expect(m.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SIGNAUX", ticker: "MTNN", exchange: "NGX", alertRuleId: "r-sig" })
    );
  });

  it("seuil de cours NGX déclenché : titre et corps en naira", async () => {
    m.priceEval.mockResolvedValue({
      checked: 1,
      triggered: 1,
      alertIds: ["a1"],
      fired: [{ id: "a1", userId: "u1", ticker: "MTNN", direction: "ABOVE", targetPrice: 320, triggerPrice: 330.5, exchange: "NGX" }],
    });
    await evaluateAllAlerts({ exchanges: ["NGX"], now: NOW, skipEmailFlush: true });
    expect(m.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PRIX",
        ticker: "MTNN",
        exchange: "NGX",
        priceAlertId: "a1",
        dedupePriceAlert: true,
        title: "MTNN a franchi ≥ ₦320,00",
      })
    );
  });

  it("cron quotidien (sans filtre) : BRVM et NGX évaluées, portefeuille et indices phares inclus", async () => {
    m.rules.mockResolvedValue([
      rule({ id: "r-ngx", kind: "DAILY_MOVE", ticker: "MTNN", companyId: "c-mtnn", params: { percent: 5 } }),
      rule({ id: "r-brvm", userId: "u2", kind: "DAILY_MOVE", ticker: "SNTS", companyId: "c-snts", params: { percent: 5 } }),
    ]);
    await evaluateAllAlerts({ now: NOW });
    expect(m.priceEval).toHaveBeenCalledWith(undefined);
    const tickers = m.emit.mock.calls.map((c) => c[0].ticker).sort();
    expect(tickers).toEqual(["MTNN", "SNTS"]);
    const brvm = m.emit.mock.calls.find((c) => c[0].ticker === "SNTS")![0];
    expect(brvm.body).toContain("FCFA");
    expect(brvm.exchange).toBe("BRVM");
    expect(m.holdings).toHaveBeenCalledTimes(2); // portefeuille + signaux
    expect(m.prefRows).toHaveBeenCalled(); // indices phares BRVM
    expect(m.flush).toHaveBeenCalled(); // 17h Abidjan : fenêtre de clôture
  });
});

describe("evaluateAllAlerts — pas de renotification d'une même séance", () => {
  const SUNDAY = new Date("2026-11-15T17:05:00.000Z");

  it("ligne de portefeuille : le cron du week-end reprend la clé de la séance de vendredi", async () => {
    const shec = { id: "c-shec", ticker: "SHEC", exchange: "BRVM" };
    m.holdings.mockResolvedValue([
      { companyId: "c-shec", company: { ticker: "SHEC" }, portfolio: { userId: "u1" }, buyDate: null, createdAt: new Date("2026-01-01"), notes: null, targetPrice: null, stopPrice: null },
      // même titre dans un 2e portefeuille du même utilisateur
      { companyId: "c-shec", company: { ticker: "SHEC" }, portfolio: { userId: "u1" }, buyDate: null, createdAt: new Date("2026-01-01"), notes: null, targetPrice: null, stopPrice: null },
    ]);
    m.companies.mockResolvedValue([shec]);
    m.latest.mockResolvedValue(
      new Map([["c-shec", { companyId: "c-shec", closePrice: 2170, date: new Date("2026-11-13T00:00:00Z"), changePercent: 6.9 }]])
    );
    m.prevPrice.mockResolvedValue({ closePrice: 2030, date: new Date("2026-11-12T00:00:00Z") });

    await evaluateAllAlerts({ now: NOW, skipEmailFlush: true });
    await evaluateAllAlerts({ now: SUNDAY, skipEmailFlush: true });

    const keys = m.emit.mock.calls.filter((c) => c[0].type === "PORTEFEUILLE").map((c) => c[0].dedupeKey);
    expect(keys).toHaveLength(4);
    expect(new Set(keys)).toEqual(new Set(["PF_MOVE:SHEC:2026-11-13"]));
  });

  it("objectif atteint : clé par niveau, identique d'un jour à l'autre", async () => {
    m.holdings.mockResolvedValue([
      { companyId: "c-snts", company: { ticker: "SNTS" }, portfolio: { userId: "u1" }, buyDate: null, createdAt: new Date("2026-01-01"), notes: null, targetPrice: 25000, stopPrice: null },
    ]);
    await evaluateAllAlerts({ now: NOW, skipEmailFlush: true });
    await evaluateAllAlerts({ now: SUNDAY, skipEmailFlush: true });
    const keys = m.emit.mock.calls.filter((c) => c[0].payload?.kind === "target").map((c) => c[0].dedupeKey);
    expect(keys).toEqual(["PF_TARGET:SNTS:25000", "PF_TARGET:SNTS:25000"]);
  });

  it("règle de variation du jour : vendredi notifié, dimanche (même séance) rien", async () => {
    m.rules.mockResolvedValue([
      rule({ id: "r-ngx", kind: "DAILY_MOVE", ticker: "MTNN", companyId: "c-mtnn", params: { percent: 5 }, lastFireKey: "2026-11-13:DAILY:MTNN:5" }),
    ]);
    await evaluateAllAlerts({ now: SUNDAY, skipEmailFlush: true });
    expect(m.emit).not.toHaveBeenCalled();
  });

  it("signal inchangé (déjà notifié ACHAT FORT) : pas de nouvelle alerte", async () => {
    m.rules.mockResolvedValue([
      rule({ id: "r-sig", kind: "SIGNAL_ENTRY", ticker: "MTNN", companyId: "c-mtnn", params: { signal: "ACHAT FORT" } }),
    ]);
    m.screener.mockResolvedValue({ rows: [{ ticker: "MTNN", overall: 72, technical: { signal: { label: "ACHAT FORT" } } }] });
    m.eventFind.mockResolvedValue({ payload: { signal: "ACHAT FORT", score: 70 } });
    await evaluateAllAlerts({ exchanges: ["NGX"], now: SUNDAY, skipEmailFlush: true });
    expect(m.emit).not.toHaveBeenCalled();
    // ACHAT → ACHAT FORT : nouvelle information
    m.eventFind.mockResolvedValue({ payload: { signal: "ACHAT", score: 60 } });
    await evaluateAllAlerts({ exchanges: ["NGX"], now: SUNDAY, skipEmailFlush: true });
    expect(m.emit).toHaveBeenCalledTimes(1);
  });
});
