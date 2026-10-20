import { describe, expect, it } from "vitest";
import { capAttemptTimeout, isIngestBudgetError } from "./fetch-budget";
import { HttpFetchError } from "./http-client";
import {
  DEFAULT_VERCEL_INGEST_BUDGET_MS,
  INGEST_SAFETY_MS,
  allocatedOptionalMs,
  createTimeBudget,
  forEachUntilBudget,
  planOptionalIngestSteps,
  preferCompleteTertiary,
  resolveIngestBudgetMs,
  richbourseWantMs,
  sliceTickersForRun,
  withTimeout,
} from "./time-budget";

describe("createTimeBudget / forEachUntilBudget", () => {
  it("s'arrête avant l'élément qui n'a plus le minimum requis", async () => {
    let now = 1_000;
    const budget = createTimeBudget(100, () => now);
    const seen: number[] = [];
    const result = await forEachUntilBudget([1, 2, 3, 4], budget, 30, async (n) => {
      seen.push(n);
      now += 40;
    });
    expect(seen).toEqual([1, 2]);
    expect(result).toEqual({ processed: 2, deferred: 2, stoppedEarly: true });
    expect(budget.remainingMs()).toBe(20);
    expect(budget.canStart(30)).toBe(false);
    expect(budget.expired()).toBe(false);
  });

  it("ne démarre rien si le budget est déjà épuisé", async () => {
    let now = 500;
    const budget = createTimeBudget(100, () => now);
    now = 600;
    const seen: string[] = [];
    const result = await forEachUntilBudget(["A", "B"], budget, 1, async (ticker) => {
      seen.push(ticker);
    });
    expect(seen).toEqual([]);
    expect(result.stoppedEarly).toBe(true);
    expect(result.deferred).toBe(2);
    expect(budget.expired()).toBe(true);
  });

  it("parcourt toute la liste quand le temps suffit", async () => {
    const budget = createTimeBudget(10_000, () => 0);
    const result = await forEachUntilBudget([1, 2], budget, 1, async () => undefined);
    expect(result).toEqual({ processed: 2, deferred: 0, stoppedEarly: false });
  });
});

describe("planOptionalIngestSteps", () => {
  const enabled = {
    richbourseQuotesEnabled: true,
    richbourseWantMs: 36_000,
    historyOnDailyCron: true,
    documentsOnDailyCron: true,
    indexOnDailyCron: true,
  };

  it("ne cumule pas des planchers au-delà du temps restant", () => {
    // Ancien code : Math.max(10s, reste) + Math.max(15s, reste) + Math.max(8s, reste)
    // sur un elapsed figé → 33s de travail alors qu'il ne reste que 25s.
    const remainingMs = 25_000;
    const plan = planOptionalIngestSteps({ ...enabled, remainingMs });
    expect(allocatedOptionalMs(plan)).toBeLessThanOrEqual(remainingMs - INGEST_SAFETY_MS);
    expect(allocatedOptionalMs(plan) + plan.safetyMs).toBeLessThanOrEqual(remainingMs);
    expect(plan.richbourseQuotes.run).toBe(true);
    expect(plan.indexEnrichment.run).toBe(false);
    expect(plan.historyBackfill.run).toBe(false);
    expect(plan.chartSeries.run).toBe(false);
    expect(plan.alerts.run).toBe(false);
  });

  it("saute toutes les étapes optionnelles quand il ne reste que la marge", () => {
    const plan = planOptionalIngestSteps({ ...enabled, remainingMs: 5_000, richbourseWantMs: 140_000 });
    expect(allocatedOptionalMs(plan)).toBe(0);
    expect(plan.richbourseQuotes.run).toBe(false);
    expect(plan.richbourseQuotes.reason).toMatch(/reste utile/);
  });

  it("réserve d'abord le croisement Richbourse puis partage le reste", () => {
    const plan = planOptionalIngestSteps({ ...enabled, historyOnDailyCron: false, remainingMs: 200_000 });
    expect(plan.richbourseQuotes.budgetMs).toBe(36_000);
    expect(plan.indexEnrichment.budgetMs).toBe(30_000);
    expect(plan.historyBackfill.run).toBe(false);
    expect(plan.historyBackfill.reason).toMatch(/hors cron/);
    expect(plan.documents.budgetMs).toBe(24_000);
    expect(plan.chartSeries.budgetMs).toBe(20_000);
    expect(plan.alerts.budgetMs).toBe(12_000);
    expect(allocatedOptionalMs(plan) + INGEST_SAFETY_MS).toBeLessThanOrEqual(200_000);
  });
});

describe("sliceTickersForRun", () => {
  const tickers = ["SNTS", "SGBC", "ABJC", "BOAB", "ETIT", "ORAC"];

  it("couvre chaque ticker une fois sur plusieurs jours, sans doublon le même jour", () => {
    const seen = new Set<string>();
    for (let day = 0; day < 3; day++) {
      const { selected, deferred } = sliceTickersForRun(tickers, day, 2);
      expect(selected).toHaveLength(2);
      expect(deferred).toHaveLength(4);
      expect(new Set(selected).size).toBe(2);
      for (const ticker of selected) {
        expect(seen.has(ticker)).toBe(false);
        seen.add(ticker);
      }
    }
    expect([...seen].sort()).toEqual([...tickers].sort());
  });

  it("prend tout le monde quand la fenêtre couvre la liste", () => {
    const { selected, deferred } = sliceTickersForRun(["sgbc", "SNTS", "SGBC"], 4, 10);
    expect(selected).toEqual(["SGBC", "SNTS"]);
    expect(deferred).toEqual([]);
  });
});

describe("richbourseWantMs / resolveIngestBudgetMs", () => {
  it("plafonne le tertiaire quand BRVM a déjà les cours, et l'ouvre si les deux sources prioritaires sont vides", () => {
    expect(
      richbourseWantMs({ tickerCount: 47, brvmQuotesOk: true, sikaQuotesOk: true, preferComplete: false })
    ).toBe(36_000);
    expect(
      richbourseWantMs({ tickerCount: 47, brvmQuotesOk: false, sikaQuotesOk: false, preferComplete: false })
    ).toBe(140_000);
    expect(
      richbourseWantMs({ tickerCount: 47, brvmQuotesOk: true, sikaQuotesOk: true, preferComplete: true })
    ).toBe(47 * 4_000);
  });

  it("borne le cron Vercel à 240s sauf override explicite", () => {
    expect(resolveIngestBudgetMs(undefined, {})).toBe(15 * 60_000);
    expect(resolveIngestBudgetMs(undefined, { VERCEL: "1" })).toBe(DEFAULT_VERCEL_INGEST_BUDGET_MS);
    expect(resolveIngestBudgetMs(undefined, { VERCEL: "1", INGESTION_CRON_BUDGET_MS: "180000" })).toBe(180_000);
    expect(resolveIngestBudgetMs(90_000, { VERCEL: "1" })).toBe(90_000);
    expect(preferCompleteTertiary(DEFAULT_VERCEL_INGEST_BUDGET_MS)).toBe(false);
    expect(preferCompleteTertiary(15 * 60_000)).toBe(true);
  });
});

describe("capAttemptTimeout", () => {
  it("garde le timeout demandé hors budget, et refuse une tentative trop courte", () => {
    expect(capAttemptTimeout(15_000, null)).toBe(15_000);
    expect(capAttemptTimeout(15_000, 20_000)).toBe(15_000);
    expect(capAttemptTimeout(15_000, 5_000)).toBe(4_750);
    expect(capAttemptTimeout(15_000, 600)).toBeNull();
  });

  it("reconnaît l'erreur de budget pour interrompre les retries", () => {
    expect(isIngestBudgetError(new HttpFetchError("Budget temps épuisé avant https://example.test"))).toBe(true);
    expect(isIngestBudgetError(new Error("HTTP 500"))).toBe(false);
  });
});

describe("withTimeout", () => {
  it("rejette quand la promesse dépasse le délai", async () => {
    await expect(withTimeout(new Promise((resolve) => setTimeout(resolve, 200)), 30, "lecture sociétés")).rejects.toThrow(
      /lecture sociétés : délai 30ms dépassé/
    );
  });

  it("résout quand la promesse tient dans le délai", async () => {
    await expect(withTimeout(Promise.resolve(7), 200, "ok")).resolves.toBe(7);
  });
});
