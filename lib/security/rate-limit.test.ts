import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, __resetRateLimitStateForTests } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    __resetRateLimitStateForTests();
    vi.useRealTimers();
  });

  it("autorise les requêtes tant que la limite n'est pas atteinte", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    const r1 = checkRateLimit("ip:route", opts);
    const r2 = checkRateLimit("ip:route", opts);
    const r3 = checkRateLimit("ip:route", opts);

    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);
  });

  it("bloque la requête qui dépasse la limite dans la même fenêtre", () => {
    const opts = { limit: 2, windowMs: 60_000 };
    checkRateLimit("ip:route", opts);
    checkRateLimit("ip:route", opts);
    const r3 = checkRateLimit("ip:route", opts);

    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("réinitialise le compteur une fois la fenêtre expirée", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const opts = { limit: 1, windowMs: 1000 };

    const r1 = checkRateLimit("ip:route", opts);
    expect(r1.allowed).toBe(true);

    const r2 = checkRateLimit("ip:route", opts);
    expect(r2.allowed).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T00:00:01.001Z"));
    const r3 = checkRateLimit("ip:route", opts);
    expect(r3.allowed).toBe(true);
    vi.useRealTimers();
  });

  it("isole les compteurs par clé (ex: par IP)", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    const a1 = checkRateLimit("ip-a:route", opts);
    const b1 = checkRateLimit("ip-b:route", opts);
    const a2 = checkRateLimit("ip-a:route", opts);

    expect(a1.allowed).toBe(true);
    expect(b1.allowed).toBe(true);
    expect(a2.allowed).toBe(false);
  });
});
