import { describe, expect, it } from "vitest";
import {
  generateAuthTokenSecret,
  hashAuthToken,
  isAuthTokenCurrentlyValid,
  ttlForAuthTokenType,
  EMAIL_VERIFY_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from "./tokens";

describe("auth tokens", () => {
  it("génère des secrets assez longs et distincts", () => {
    const a = generateAuthTokenSecret();
    const b = generateAuthTokenSecret();
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(b).not.toEqual(a);
  });

  it("hache de façon déterministe (SHA-256 hex)", () => {
    const hash = hashAuthToken("secret-de-test");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAuthToken("secret-de-test")).toEqual(hash);
    expect(hashAuthToken("autre")).not.toEqual(hash);
  });

  it("définit des durées d'expiration distinctes", () => {
    expect(ttlForAuthTokenType("EMAIL_VERIFY")).toBe(EMAIL_VERIFY_TTL_MS);
    expect(ttlForAuthTokenType("PASSWORD_RESET")).toBe(PASSWORD_RESET_TTL_MS);
    expect(PASSWORD_RESET_TTL_MS).toBeLessThan(EMAIL_VERIFY_TTL_MS);
  });

  it("rejette un jeton déjà utilisé, expiré ou du mauvais type", () => {
    const now = Date.parse("2026-09-13T12:00:00.000Z");
    const base = {
      type: "PASSWORD_RESET" as const,
      usedAt: null,
      expiresAt: new Date(now + 60_000),
    };
    expect(isAuthTokenCurrentlyValid(base, "PASSWORD_RESET", now)).toBe(true);
    expect(isAuthTokenCurrentlyValid(base, "EMAIL_VERIFY", now)).toBe(false);
    expect(isAuthTokenCurrentlyValid({ ...base, usedAt: new Date(now) }, "PASSWORD_RESET", now)).toBe(false);
    expect(
      isAuthTokenCurrentlyValid({ ...base, expiresAt: new Date(now) }, "PASSWORD_RESET", now)
    ).toBe(false);
  });
});
