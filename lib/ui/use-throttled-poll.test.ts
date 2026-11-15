import { describe, expect, it } from "vitest";
import { isSoftRefreshDue, SOFT_REFRESH_MS } from "./use-throttled-poll";

describe("isSoftRefreshDue", () => {
  it("10 minutes par défaut", () => {
    expect(SOFT_REFRESH_MS).toBe(600_000);
    expect(isSoftRefreshDue(0, 599_999)).toBe(false);
    expect(isSoftRefreshDue(0, 600_000)).toBe(true);
  });
  it("intervalle personnalisé", () => {
    expect(isSoftRefreshDue(1_000, 2_000, 1_000)).toBe(true);
    expect(isSoftRefreshDue(1_000, 1_500, 1_000)).toBe(false);
  });
});
