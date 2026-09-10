import { describe, expect, it } from "vitest";
import { computeRsi, computeTechnicalSnapshot, type ClosePoint } from "./technical-indicators";

function series(n: number, start = 100, step = 0.5): ClosePoint[] {
  return Array.from({ length: n }, (_, i) => ({
    time: `2024-${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
    value: start + i * step,
  }));
}

describe("computeRsi", () => {
  it("retourne null si série trop courte", () => {
    expect(computeRsi([1, 2, 3])).toBeNull();
  });
});

describe("computeTechnicalSnapshot", () => {
  it("N/D sous 30 points", () => {
    const s = computeTechnicalSnapshot(series(20));
    expect(s.available).toBe(false);
    expect(s.shortTermScore).toBeNull();
  });

  it("calcule RSI/SMA sur tendance haussière", () => {
    const s = computeTechnicalSnapshot(series(80, 100, 1));
    expect(s.available).toBe(true);
    expect(s.rsi14).not.toBeNull();
    expect(s.rsi14!).toBeGreaterThan(50);
    expect(s.sma10).not.toBeNull();
    expect(s.sma20).not.toBeNull();
    expect(s.shortTermScore).not.toBeNull();
    expect(s.shortTermScore!).toBeGreaterThanOrEqual(40);
  });
});
