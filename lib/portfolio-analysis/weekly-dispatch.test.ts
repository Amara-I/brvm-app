import { describe, expect, it, vi } from "vitest";
import type { PortfolioAnalysis } from "./analyze";
import { DEFAULT_PREFS, type PrefsSnapshot } from "@/lib/notifications/types";
import { dispatchWeeklyPortfolioProposals, type WeeklyDispatchDeps } from "./weekly-dispatch";

function analysis(name: string): PortfolioAnalysis {
  return {
    portfolioId: "p",
    portfolioName: name,
    capitalFcfa: 1,
    portfolioValueFcfa: 1,
    capitalSource: "portfolio",
    unconvertedTickers: [],
    riskPercent: 1,
    riskSource: "derived",
    limits: { stockPct: 15, sectorPct: 35, countryPct: 50, marketPct: 80 },
    buckets: [],
    markets: {} as PortfolioAnalysis["markets"],
    macros: [],
    fx: { ngnPerEur: null, xofPerNgn: null, asOf: null, source: null },
    holdings: [],
    proposals: [],
    coherence: [],
  };
}

describe("dispatchWeeklyPortfolioProposals", () => {
  it("respecte l'opt-out, le doublon de la semaine, et notifie les autres", async () => {
    const emit = vi.fn(async () => ({ created: true as const, id: "n1", emailed: false }));
    const prefs = new Map<string, PrefsSnapshot>([
      ["opt-out", { ...DEFAULT_PREFS, portfolioEnabled: false }],
      ["channels-off", { ...DEFAULT_PREFS, channelInApp: false, channelEmail: false }],
      ["dup", DEFAULT_PREFS],
      ["ok", { ...DEFAULT_PREFS, channelEmail: true }],
    ]);
    const deps: WeeklyDispatchDeps = {
      listUserIds: async () => ["opt-out", "channels-off", "dup", "ok"],
      loadPrefs: async () => prefs,
      alreadySent: async (userId) => userId === "dup",
      loadAnalyses: async (ids) => new Map(ids.map((id) => [id, [analysis(id)]])),
      emit,
    };

    const stats = await dispatchWeeklyPortfolioProposals(new Date("2026-11-09T06:00:00.000Z"), deps);
    expect(stats).toEqual({ users: 4, notified: 1, optedOut: 2, duplicates: 1, errors: 0 });
    expect(emit).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "ok",
        type: "PORTEFEUILLE",
        href: "/portefeuille/analyse",
        payload: { kind: "weekly_portfolio_proposals", week: "2026-11-09" },
        prefs: expect.objectContaining({ channelEmail: true }),
      })
    );
  });
});
