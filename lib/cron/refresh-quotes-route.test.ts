import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const brvm = vi.hoisted(() => vi.fn());
const ngx = vi.hoisted(() => vi.fn());
const revalidateQuotes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ingestion/run-brvm-quotes-refresh", () => ({ runBrvmQuotesRefresh: brvm }));
vi.mock("@/lib/ingestion/run-ngx-ingest", () => ({ runNgxDailyIngest: ngx }));
vi.mock("@/lib/ingestion/alerts", () => ({ sendIngestionAlert: vi.fn(async () => undefined) }));
vi.mock("@/lib/api/revalidate-market-cache", () => ({ revalidateMarketDataCache: vi.fn() }));
vi.mock("@/lib/cache/revalidate-quotes", () => ({ revalidateQuotesAfterWrite: revalidateQuotes }));
vi.mock("@/lib/notifications/evaluate-all", () => ({ evaluateAllAlerts: vi.fn(async () => ({})) }));

import { GET } from "@/app/api/cron/refresh-quotes/route";

const url = (qs: string) => new NextRequest(`https://example.org/api/cron/refresh-quotes${qs}`, {
  headers: { authorization: "Bearer test-only-cron" },
});

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-only-cron");
  brvm.mockReset().mockResolvedValue({
    quotesFetched: 48,
    fundamentalsFetched: 0,
    reconciledPricesCount: 48,
    unknownTickers: [],
    errors: [],
    durationMs: 1,
    skipped: false,
  });
  ngx.mockReset().mockResolvedValue({ status: "SUCCESS", quotes: 146, indices: 5, errors: [] });
  revalidateQuotes.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

it("refuse sans secret", async () => {
  const res = await GET(new NextRequest("https://example.org/api/cron/refresh-quotes"));
  expect(res.status).toBe(401);
  expect(brvm).not.toHaveBeenCalled();
});

it("hors séance (week-end) : aucune requête vers la source", async () => {
  vi.useFakeTimers({ now: new Date("2026-11-14T10:00:00Z") });
  const res = await GET(url("?market=ALL"));
  const json = await res.json();
  expect(json.data.brvm.skipped).toBe(true);
  expect(json.data.ngx.skipped).toBe(true);
  expect(brvm).not.toHaveBeenCalled();
  expect(ngx).not.toHaveBeenCalled();
});

it("en séance : tire les cours, sans graphes NGX, et invalide les derniers cours", async () => {
  vi.useFakeTimers({ now: new Date("2026-11-13T10:00:00Z") });
  const res = await GET(url("?market=ALL&alerts=0"));
  expect(res.status).toBe(200);
  expect(brvm).toHaveBeenCalledWith({ skipFundamentals: true, evaluateAlerts: false });
  expect(ngx).toHaveBeenCalledWith(expect.objectContaining({ refreshCharts: false }));
  expect(revalidateQuotes).toHaveBeenCalledWith({ markets: ["BRVM"] });
  expect(revalidateQuotes).toHaveBeenCalledWith({ markets: ["NGX"] });
});

it("force=1 : tire même hors séance (BRVM par défaut)", async () => {
  vi.useFakeTimers({ now: new Date("2026-11-14T10:00:00Z") });
  await GET(url("?force=1"));
  expect(brvm).toHaveBeenCalledTimes(1);
  expect(ngx).not.toHaveBeenCalled();
});
