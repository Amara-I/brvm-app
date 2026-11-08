import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_VERCEL_INGEST_BUDGET_MS } from "@/lib/ingestion/time-budget";
import {
  CRON_RESPONSE_MARGIN_MS,
  DAILY_FOLLOW_UP_RESERVE_MS,
  ENRICH_CALL_LIMIT,
  FINANCE_AGENT_DAILY_CAP_MS,
  HOBBY_FUNCTION_MAX_MS,
  MIN_ENRICH_STEP_MS,
  dailyIngestBudgetMs,
  scheduledFollowUpReserveMs,
  runDailyAfterClose,
  type DailyEnrichCall,
  type DailyEnrichResult,
} from "./daily-follow-up";

const INGEST_BUDGET = HOBBY_FUNCTION_MAX_MS - CRON_RESPONSE_MARGIN_MS - DAILY_FOLLOW_UP_RESERVE_MS;

function clock(start: number) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
    jump: (ms: number) => {
      t = ms;
    },
  };
}

describe("dailyIngestBudgetMs", () => {
  const bothOn = { FINANCE_AGENT_ENABLED: "true", INGESTION_ADDITIVE_ENABLED: "true" };

  it("garde les 240 s tant que le suivi est désactivé, et les cède seulement s'il est armé", () => {
    expect(INGEST_BUDGET + DAILY_FOLLOW_UP_RESERVE_MS + CRON_RESPONSE_MARGIN_MS).toBe(HOBBY_FUNCTION_MAX_MS);
    expect(scheduledFollowUpReserveMs({})).toBe(0);
    expect(dailyIngestBudgetMs({})).toBe(DEFAULT_VERCEL_INGEST_BUDGET_MS);
    expect(dailyIngestBudgetMs({ FINANCE_AGENT_ENABLED: "true" })).toBe(DEFAULT_VERCEL_INGEST_BUDGET_MS);
    expect(dailyIngestBudgetMs({ INGESTION_ADDITIVE_ENABLED: "true" })).toBe(
      HOBBY_FUNCTION_MAX_MS - CRON_RESPONSE_MARGIN_MS - MIN_ENRICH_STEP_MS * 4
    );
    expect(dailyIngestBudgetMs(bothOn)).toBe(INGEST_BUDGET);
    expect(dailyIngestBudgetMs({ ...bothOn, INGESTION_CRON_BUDGET_MS: "270000" })).toBe(INGEST_BUDGET);
    expect(dailyIngestBudgetMs({ INGESTION_CRON_BUDGET_MS: "90000" })).toBe(90_000);
    expect(dailyIngestBudgetMs({ INGESTION_CRON_BUDGET_MS: "nope" })).toBe(DEFAULT_VERCEL_INGEST_BUDGET_MS);
  });
});

describe("runDailyAfterClose", () => {
  beforeEach(() => {
    vi.stubEnv("INGESTION_ADDITIVE_ENABLED", "true");
    vi.stubEnv("INGESTION_ADDITIVE_BRVM", "");
    vi.stubEnv("INGESTION_ADDITIVE_NGX", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function runAt(elapsedIngestMs: number, deps: {
    finance?: (deadlineMs: number) => Promise<unknown>;
    enrich?: (input: DailyEnrichCall) => Promise<DailyEnrichResult>;
  }) {
    const time = clock(elapsedIngestMs);
    const finance = vi.fn(deps.finance ?? (async () => ({ enabled: false, aiStatus: "NOT_REQUESTED" })));
    const enrich = vi.fn(deps.enrich ?? (async () => ({ incomplete: false, failed: false, results: [] })));
    const pending = runDailyAfterClose({
      startedAtMs: 0,
      now: time.now,
      logger: () => undefined,
      runFinance: (deadline) => finance(deadline),
      runEnrich: (input) => enrich(input),
    });
    return { time, finance, enrich, pending };
  }

  it("après une ingestion pleine, lance l'agent puis les quatre files", async () => {
    const { finance, enrich, pending } = runAt(INGEST_BUDGET, {
      finance: async (deadline) => {
        expect(deadline).toBeLessThanOrEqual(INGEST_BUDGET + FINANCE_AGENT_DAILY_CAP_MS);
        return { enabled: true, aiStatus: "NOT_REQUESTED", ticker: "SNTS" };
      },
      enrich: async (input) => ({ incomplete: true, failed: false, results: [{}], next: 1, total: 100, budget: input.budgetMs }),
    });
    const summary = await pending;
    expect(finance).toHaveBeenCalledTimes(1);
    const inputs = enrich.mock.calls.flatMap((call) => (call[0] ? [call[0]] : []));
    expect(inputs.map((input) => `${input.exchange}:${input.kind}`)).toEqual([
      "BRVM:history",
      "NGX:history",
      "BRVM:publications",
      "NGX:publications",
    ]);
    for (const input of inputs) {
      expect(input).toMatchObject({ apply: "1", limit: ENRICH_CALL_LIMIT, from: "2006-01-01" });
      expect(input.budgetMs).toBeGreaterThanOrEqual(MIN_ENRICH_STEP_MS);
      expect(input.budgetMs).toBeLessThanOrEqual(240_000);
    }
    expect(summary.steps.find((step) => step.name === "finance-agent")).toMatchObject({ skipped: false, reason: "NOT_REQUESTED" });
    expect(summary.steps.filter((step) => step.name.startsWith("enrich:") && step.skipped)).toEqual([]);
  });

  it("un agent qui échoue ne bloque pas le rattrapage", async () => {
    const { enrich, pending } = runAt(INGEST_BUDGET, {
      finance: async () => {
        throw new Error("agent down");
      },
    });
    const summary = await pending;
    expect(summary.steps[0]).toMatchObject({ name: "finance-agent", skipped: false, reason: "agent down" });
    expect(enrich).toHaveBeenCalledTimes(4);
  });

  it("une file en échec ne bloque pas les suivantes et n'est pas rejouée dans le même passage", async () => {
    const seen: string[] = [];
    const { pending } = runAt(INGEST_BUDGET, {
      enrich: async (input) => {
        const key = `${input.exchange}:${input.kind}`;
        seen.push(key);
        if (key === "BRVM:history") throw new Error("sika down");
        return { incomplete: true, failed: true, results: [{ status: "ECHEC" }] };
      },
    });
    const summary = await pending;
    expect(seen).toEqual(["BRVM:history", "NGX:history", "BRVM:publications", "NGX:publications"]);
    expect(summary.steps.find((step) => step.name === "enrich:BRVM:history")?.reason).toMatch(/sika down/);
    expect(summary.steps.find((step) => step.name === "enrich:NGX:history")).toMatchObject({
      skipped: false,
      calls: 1,
      reason: "fenêtre en échec ou en quarantaine — curseur conservé",
    });
  });

  it("reprend une file tant que le plafond d'unités est atteint et que le temps reste", async () => {
    const counts = new Map<string, number>();
    const { pending } = runAt(INGEST_BUDGET, {
      enrich: async (input) => {
        const key = `${input.exchange}:${input.kind}`;
        const n = (counts.get(key) ?? 0) + 1;
        counts.set(key, n);
        if (key === "BRVM:history" && n === 1) {
          return { incomplete: true, failed: false, results: Array.from({ length: ENRICH_CALL_LIMIT }, () => ({})) };
        }
        return { incomplete: false, failed: false, results: [{}] };
      },
    });
    await pending;
    expect(counts.get("BRVM:history")).toBe(2);
    expect(counts.get("NGX:history")).toBe(1);
  });

  it("sans flag d'écriture, ne collecte rien", async () => {
    vi.stubEnv("INGESTION_ADDITIVE_ENABLED", "false");
    const { enrich, pending } = runAt(INGEST_BUDGET, {});
    const summary = await pending;
    expect(enrich).not.toHaveBeenCalled();
    const enrichSteps = summary.steps.filter((step) => step.name.startsWith("enrich:"));
    expect(enrichSteps).toHaveLength(4);
    expect(enrichSteps.every((step) => step.skipped && step.reason?.includes("INGESTION_ADDITIVE_ENABLED"))).toBe(true);
  });

  it("une source désactivée laisse son temps aux autres", async () => {
    vi.stubEnv("INGESTION_ADDITIVE_NGX", "false");
    const { enrich, pending } = runAt(INGEST_BUDGET, {});
    const summary = await pending;
    expect(enrich.mock.calls.map((call) => call[0]?.exchange)).toEqual(["BRVM", "BRVM"]);
    expect(summary.steps.find((step) => step.name === "enrich:NGX:history")).toMatchObject({
      skipped: true,
      reason: "Source désactivée",
    });
  });

  it("un agent qui consomme son plafond laisse encore une unité à chaque file", async () => {
    const time = clock(INGEST_BUDGET);
    const enrich = vi.fn(async () => ({ incomplete: true, failed: false, results: [{}] }));
    const summary = await runDailyAfterClose({
      startedAtMs: 0,
      now: time.now,
      logger: () => undefined,
      runFinance: async (deadline) => {
        time.jump(deadline);
        return { enabled: true, aiStatus: "SKIPPED_TIME_BUDGET" };
      },
      runEnrich: enrich,
    });
    expect(enrich).toHaveBeenCalledTimes(4);
    expect(summary.steps.filter((step) => step.name.startsWith("enrich:") && step.skipped)).toEqual([]);
  });

  it("ne démarre rien quand l'ingestion a déjà épuisé la fonction", async () => {
    const { finance, enrich, pending } = runAt(HOBBY_FUNCTION_MAX_MS - CRON_RESPONSE_MARGIN_MS, {});
    const summary = await pending;
    expect(finance).not.toHaveBeenCalled();
    expect(enrich).not.toHaveBeenCalled();
    expect(summary.steps.every((step) => step.skipped)).toBe(true);
  });
});
