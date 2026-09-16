import { describe, expect, it, vi } from "vitest";
import { buildHealthPayload, probeDatabase } from "./health-check";

describe("probeDatabase", () => {
  it("retourne ok et une latence quand SELECT 1 réussit", async () => {
    const result = await probeDatabase(async () => undefined);
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result).toEqual({ ok: true, latencyMs: result.latencyMs });
  });

  it("retourne ok:false sans fuite d'hôte / secret quand Prisma est injoignable", async () => {
    const result = await probeDatabase(async () => {
      throw new Error("Can't reach database server at db.xxx.supabase.co:5432");
    });

    const serialized = JSON.stringify(result);
    expect(result.ok).toBe(false);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(serialized).not.toContain("supabase");
    expect(serialized).not.toContain("5432");
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("Can't reach");
  });

  it("n'expose pas le message brut d'une erreur inattendue", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await probeDatabase(async () => {
      throw new Error("postgresql://user:supersecret@localhost/brvm");
    });
    expect(error).toHaveBeenCalled();
    error.mockRestore();

    const serialized = JSON.stringify(result);
    expect(result.ok).toBe(false);
    expect(serialized).not.toContain("supersecret");
    expect(serialized).not.toContain("postgresql://");
  });

  it("coupe la sonde après le timeout plutôt que de laisser pendre le monitor", async () => {
    const result = await probeDatabase(() => new Promise(() => undefined), 40);
    expect(result.ok).toBe(false);
    expect(result.latencyMs).toBeLessThan(1_000);
  });
});

describe("buildHealthPayload", () => {
  it("répond 200 quand la base est saine", () => {
    expect(buildHealthPayload({ ok: true, latencyMs: 12 })).toEqual({
      status: 200,
      body: { ok: true, checks: { database: { ok: true, latencyMs: 12 } } },
    });
  });

  it("répond 503 quand la base est down", () => {
    expect(buildHealthPayload({ ok: false, latencyMs: 3001 })).toEqual({
      status: 503,
      body: { ok: false, checks: { database: { ok: false, latencyMs: 3001 } } },
    });
  });
});
