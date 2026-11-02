import { expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
const run = vi.hoisted(() => vi.fn(async () => ({ enabled: false })));
vi.mock("./run", () => ({ runFinanceAgent: run }));
import { GET } from "@/app/api/cron/finance-agent/route";
afterEach(() => { vi.unstubAllEnvs(); run.mockClear(); });
it("refuse le secret en URL et l’absence d’authentification", async () => {
  vi.stubEnv("CRON_SECRET", "test-only");
  expect((await GET(new NextRequest("https://example.org/api/cron/finance-agent?secret=test-only"))).status).toBe(401);
  expect(run).not.toHaveBeenCalled();
});
it("retourne l’état désactivé sans mettre de données en cache public", async () => {
  vi.stubEnv("CRON_SECRET", "test-only");
  const response = await GET(new NextRequest("https://example.org/api/cron/finance-agent", { headers: { authorization: "Bearer test-only" } }));
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
});
