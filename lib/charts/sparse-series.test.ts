import { describe, expect, it } from "vitest";
import { flatPriceBounds, seriesWithAnnualFallback } from "./sparse-series";

describe("seriesWithAnnualFallback", () => {
  const annual = [{ time: "2026-12-31", value: 6750, volume: null }];

  it("conserve une clôture unique au lieu du repli annuel", () => {
    const loaded = [{ time: "2026-09-15", value: 6750, volume: null }];
    expect(seriesWithAnnualFallback(loaded, annual)).toEqual(loaded);
  });

  it("conserve une série courte de quelques séances", () => {
    const loaded = [
      { time: "2026-09-15", value: 6750, volume: null },
      { time: "2026-09-16", value: 6800, volume: 100 },
    ];
    expect(seriesWithAnnualFallback(loaded, annual)).toEqual(loaded);
  });

  it("utilise le repli annuel seulement sans aucun cours chargé", () => {
    expect(seriesWithAnnualFallback([], annual)).toEqual(annual);
    expect(seriesWithAnnualFallback([], [])).toEqual([]);
  });
});

describe("flatPriceBounds", () => {
  it("ajoute une marge autour d'une clôture isolée", () => {
    const bounds = flatPriceBounds([6750]);
    expect(bounds).not.toBeNull();
    expect(bounds!.min).toBeLessThan(6750);
    expect(bounds!.max).toBeGreaterThan(6750);
    expect(bounds!.max - bounds!.min).toBeCloseTo(6750 * 0.04, 5);
  });

  it("laisse l'échelle auto dès qu'il y a une amplitude", () => {
    expect(flatPriceBounds([6750, 6800])).toBeNull();
  });

  it("ignore une liste vide", () => {
    expect(flatPriceBounds([])).toBeNull();
  });
});
