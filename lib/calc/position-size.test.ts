import { describe, expect, it } from "vitest";
import {
  SOGB_STYLE_EXAMPLE,
  computePositionSize,
  latestPositivePrice,
} from "./position-size";

describe("computePositionSize", () => {
  it("exemple SOGB-style : 1 000 000 × 5 % / (8400 − 7560) → 60 titres", () => {
    const r = computePositionSize(SOGB_STYLE_EXAMPLE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.riskBudget).toBe(50_000);
    expect(r.riskPerShare).toBe(840);
    expect(r.sharesRaw).toBeCloseTo(50_000 / 840, 8);
    expect(r.shares).toBe(60);
    expect(r.invested).toBe(60 * 8_400);
    expect(r.maxLossAtStop).toBe(60 * 840);
    expect(r.maxLossPercentOfCapital).toBeCloseTo(5.04, 2);
    expect(r.roundingExceedsBudget).toBe(true);
  });

  it("rejette un stop ≥ entrée (long)", () => {
    const r = computePositionSize({
      capital: 1_000_000,
      riskPercent: 5,
      entryPrice: 8_400,
      stopPrice: 8_400,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("stop_non_inferieur");
  });

  it("rejette un stop au-dessus de l’entrée", () => {
    const r = computePositionSize({
      capital: 1_000_000,
      riskPercent: 3,
      entryPrice: 10_000,
      stopPrice: 10_500,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("stop_non_inferieur");
  });

  it("rejette un capital ou un taux invalide", () => {
    const zeroCap = computePositionSize({ capital: 0, riskPercent: 5, entryPrice: 100, stopPrice: 90 });
    expect(zeroCap.ok).toBe(false);
    if (!zeroCap.ok) expect(zeroCap.code).toBe("capital_invalide");

    const zeroRate = computePositionSize({ capital: 1000, riskPercent: 0, entryPrice: 100, stopPrice: 90 });
    expect(zeroRate.ok).toBe(false);
    if (!zeroRate.ok) expect(zeroRate.code).toBe("taux_invalide");

    const highRate = computePositionSize({ capital: 1000, riskPercent: 25, entryPrice: 100, stopPrice: 90 });
    expect(highRate.ok).toBe(false);
    if (!highRate.ok) expect(highRate.code).toBe("taux_invalide");
  });

  it("rejette une quantité < 1 action", () => {
    const r = computePositionSize({
      capital: 10_000,
      riskPercent: 3,
      entryPrice: 50_000,
      stopPrice: 1_000,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("quantite_nulle");
  });

  it("n’invente pas de cours : prix d’entrée / stop doivent être fournis", () => {
    const noEntry = computePositionSize({ capital: 1e6, riskPercent: 5, entryPrice: 0, stopPrice: 100 });
    expect(noEntry.ok).toBe(false);
    if (!noEntry.ok) expect(noEntry.code).toBe("prix_entree_invalide");

    const noStop = computePositionSize({ capital: 1e6, riskPercent: 5, entryPrice: 100, stopPrice: Number.NaN });
    expect(noStop.ok).toBe(false);
    if (!noStop.ok) expect(noStop.code).toBe("prix_stop_invalide");
  });
});

describe("latestPositivePrice", () => {
  it("prend l’année la plus récente avec un cours > 0", () => {
    expect(latestPositivePrice({ 2024: 0, 2025: 7875, 2026: 0 })).toBe(7875);
    expect(latestPositivePrice({ 2026: 32000 })).toBe(32000);
    expect(latestPositivePrice({ 2024: 0, 2025: 0 })).toBeNull();
    expect(latestPositivePrice(undefined)).toBeNull();
  });
});
