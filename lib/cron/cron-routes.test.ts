import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ingest = vi.hoisted(() => vi.fn(async () => ({ durationMs: 10, incomplete: false, stoppedAt: null, budgetMs: 1 })));
const follow = vi.hoisted(() => vi.fn(async () => ({ budgetMs: 50, steps: [{ name: "finance-agent", durationMs: 1, skipped: false }] })));
const alert = vi.hoisted(() => vi.fn(async () => undefined));
const research = vi.hoisted(() => vi.fn(async () => ({ enabled: false, provider: "noop" })));
const proposals = vi.hoisted(() => vi.fn(async () => ({ ran: false, skipped: true, reason: "non branché" })));

vi.mock("@/lib/ingestion/run-full-ingestion", () => ({ runFullIngestion: ingest }));
vi.mock("@/lib/ingestion/alerts", () => ({ sendIngestionAlert: alert }));
vi.mock("@/lib/cron/daily-follow-up", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cron/daily-follow-up")>("@/lib/cron/daily-follow-up");
  return { ...actual, runDailyAfterClose: follow };
});
vi.mock("@/lib/research/run-research-agent", () => ({ runResearchAgent: research }));
vi.mock("@/lib/cron/monday-hooks", () => ({ runWeeklyPortfolioProposals: proposals }));

import { dailyIngestBudgetMs } from "@/lib/cron/daily-follow-up";
import { GET as getIngest } from "@/app/api/cron/ingest/route";
import { GET as getResearch } from "@/app/api/cron/research/route";

beforeEach(() => {
  ingest.mockClear();
  follow.mockClear();
  alert.mockClear();
  research.mockClear();
  proposals.mockClear();
  vi.stubEnv("CRON_SECRET", "test-only-cron");
  ingest.mockResolvedValue({ durationMs: 10, incomplete: false, stoppedAt: null, budgetMs: 1 });
  follow.mockResolvedValue({ budgetMs: 50, steps: [{ name: "finance-agent", durationMs: 1, skipped: false }] });
  research.mockResolvedValue({ enabled: false, provider: "noop" });
  proposals.mockResolvedValue({ ran: false, skipped: true, reason: "non branché" });
});

it("refuse l'ingestion sans secret et n'enchaîne rien", async () => {
  const res = await getIngest(new NextRequest("https://example.org/api/cron/ingest"));
  expect(res.status).toBe(401);
  expect(ingest).not.toHaveBeenCalled();
  expect(follow).not.toHaveBeenCalled();
});

it("après une ingestion réussie, enchaîne le suivi sans changer le statut", async () => {
  const res = await getIngest(new NextRequest("https://example.org/api/cron/ingest", { headers: { authorization: "Bearer test-only-cron" } }));
  expect(res.status).toBe(200);
  expect(ingest).toHaveBeenCalledWith({ budgetMs: dailyIngestBudgetMs() });
  expect(follow).toHaveBeenCalledTimes(1);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.data.followUp.steps[0].name).toBe("finance-agent");
  expect(body.data.durationMs).toBe(10);
});

it("une ingestion en échec reste en erreur et ne lance pas le suivi", async () => {
  ingest.mockRejectedValue(new Error("base injoignable"));
  const res = await getIngest(new NextRequest("https://example.org/api/cron/ingest?secret=test-only-cron"));
  expect(res.status).toBe(500);
  expect(alert).toHaveBeenCalled();
  expect(follow).not.toHaveBeenCalled();
});

it("un suivi qui jette ne fait pas échouer l'ingestion déjà persistée", async () => {
  follow.mockRejectedValue(new Error("suivi cassé"));
  const res = await getIngest(new NextRequest("https://example.org/api/cron/ingest", { headers: { authorization: "Bearer test-only-cron" } }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data.followUp.steps[0].reason).toMatch(/suivi cassé/);
});

it("la veille du lundi appelle le hook même si la recherche échoue", async () => {
  research.mockRejectedValue(new Error("rss down"));
  const res = await getResearch(new NextRequest("https://example.org/api/cron/research", { headers: { authorization: "Bearer test-only-cron" } }));
  expect(res.status).toBe(500);
  expect(proposals).toHaveBeenCalledTimes(1);
  const body = await res.json();
  expect(body.portfolioProposals.reason).toBe("non branché");
  expect(body.details).toMatch(/rss down/);
});

it("une veille réussie renvoie le résultat du hook", async () => {
  const res = await getResearch(new NextRequest("https://example.org/api/cron/research", { headers: { authorization: "Bearer test-only-cron" } }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data.enabled).toBe(false);
  expect(body.portfolioProposals.skipped).toBe(true);
});

it("un hook qui jette ne fait pas échouer la veille", async () => {
  proposals.mockRejectedValue(new Error("mail down"));
  const res = await getResearch(new NextRequest("https://example.org/api/cron/research", { headers: { authorization: "Bearer test-only-cron" } }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.portfolioProposals.reason).toMatch(/mail down/);
  expect(body.portfolioProposals.skipped).toBe(false);
});
