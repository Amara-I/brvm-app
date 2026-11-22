import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const measure = vi.hoisted(() => vi.fn());
const alert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/database-size", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/database-size")>("@/lib/db/database-size");
  return { ...actual, measureDatabaseSize: measure, sendDbSizeAlert: alert };
});

import { GET } from "@/app/api/cron/db-size/route";

const sample = {
  bytes: 190_840_832,
  sizeMb: 182,
  thresholdMb: 350,
  planLimitMb: 500,
  usagePercent: 36.4,
  overThreshold: false,
  tables: [{ name: "price_history", bytes: 50_331_648, sizeMb: 48, rowCount: 12345 }],
};

beforeEach(() => {
  measure.mockReset();
  alert.mockReset();
  vi.stubEnv("CRON_SECRET", "test-only-cron");
  measure.mockResolvedValue(sample);
  alert.mockResolvedValue({ needed: false });
});

it("refuse la veille sans secret", async () => {
  const res = await GET(new NextRequest("https://example.org/api/cron/db-size"));
  expect(res.status).toBe(401);
  expect(measure).not.toHaveBeenCalled();
  expect(alert).not.toHaveBeenCalled();
});

it("renvoie le rapport sans secret dans le JSON", async () => {
  const res = await GET(
    new NextRequest("https://example.org/api/cron/db-size", { headers: { authorization: "Bearer test-only-cron" } })
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.data.sizeMb).toBe(182);
  expect(body.data.overThreshold).toBe(false);
  expect(body.data.alert).toEqual({ needed: false });
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain("test-only-cron");
  expect(serialized).not.toContain("CRON_SECRET");
  expect(serialized).not.toContain("DATABASE_URL");
  expect(serialized).not.toContain("SMTP_PASS");
});

it("répond 503 sans message brut quand la base est injoignable", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  measure.mockRejectedValue(new Error("Can't reach database server at db.xxx.supabase.co:5432"));
  const res = await GET(
    new NextRequest("https://example.org/api/cron/db-size?secret=test-only-cron")
  );
  expect(res.status).toBe(503);
  const body = await res.json();
  expect(body).toEqual({ ok: false, error: "Base injoignable" });
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain("supabase");
  expect(serialized).not.toContain("5432");
  expect(alert).not.toHaveBeenCalled();
  error.mockRestore();
});
