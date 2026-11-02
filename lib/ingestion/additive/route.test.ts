import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const run = vi.hoisted(() => vi.fn(async () => ({ apply: false })));
vi.mock("./run", () => ({ runAdditiveEnrichment: run }));
import { GET } from "@/app/api/cron/enrich-history/route";
beforeEach(() => { run.mockClear(); vi.stubEnv("CRON_SECRET", "test-only-cron"); vi.stubEnv("INGESTION_ADDITIVE_ENABLED", "false"); });
it("refuse les secrets dans l’URL même avec un en-tête arbitraire", async () => {
  const res = await GET(new NextRequest("https://example.org/api/cron/enrich-history?exchange=BRVM&secret=test-only-cron", { headers: { authorization: "arbitrary" } }));
  expect(res.status).toBe(401); expect(run).not.toHaveBeenCalled();
});
it("n’active pas l’écriture sans activation explicite", async () => {
  const res = await GET(new NextRequest("https://example.org/api/cron/enrich-history?exchange=NGX&apply=1", { headers: { authorization: "Bearer test-only-cron" } }));
  expect((await res.json()).skipped).toBe(true); expect(run).not.toHaveBeenCalled();
});
it("autorise la simulation protégée et valide les bornes", async () => {
  const res = await GET(new NextRequest("https://example.org/api/cron/enrich-history?exchange=BRVM", { headers: { authorization: "Bearer test-only-cron" } }));
  expect(res.status).toBe(200); expect(run).toHaveBeenCalledWith(expect.objectContaining({ apply: "0", from: "2006-01-01" }));
});
