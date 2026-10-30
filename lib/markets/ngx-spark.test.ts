import { describe, expect, it } from "vitest";
import { filterSeriesByHorizon, horizonChangePercent, MARKET_HORIZON_OPTIONS } from "./market-horizon";
import { packNgxSpark, unpackNgxSpark } from "./ngx-spark";

const pt = (time: string, value: number) => ({ time, value, volume: null });

describe("packNgxSpark / unpackNgxSpark", () => {
  it("N/D sous 2 points valides", () => {
    expect(packNgxSpark([])).toBeNull();
    expect(packNgxSpark([pt("2026-10-01", 10)])).toBeNull();
    expect(packNgxSpark([pt("2026-10-01", 10), pt("2026-10-02", 0)])).toBeNull();
    expect(unpackNgxSpark(null)).toEqual([]);
  });
  it("aller-retour : trie, dédoublonne par jour, arrondit", () => {
    const packed = packNgxSpark([pt("2026-10-03", 12.3456), pt("2026-10-01", 10), pt("2026-10-03", 12.5), pt("2026-10-02", 11)]);
    expect(unpackNgxSpark(packed)).toEqual([pt("2026-10-01", 10), pt("2026-10-02", 11), pt("2026-10-03", 12.5)]);
  });
  it("reste compact et alimente le filtre de période de la BRVM", () => {
    const asOf = new Date("2026-10-30T12:00:00Z");
    const days = Array.from({ length: 396 }, (_, i) => {
      const t = new Date(Date.UTC(2025, 8, 30) + i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      return pt(t, 100 + i);
    });
    const series = unpackNgxSpark(packNgxSpark(days));
    expect(series).toHaveLength(396);
    for (const h of MARKET_HORIZON_OPTIONS) {
      const sliced = filterSeriesByHorizon(series, h.value, asOf);
      expect(sliced.length).toBeGreaterThanOrEqual(2);
      expect(horizonChangePercent(sliced)).not.toBeNull();
    }
  });
  it("période courte sans données récentes → N/D plutôt qu'un repli trompeur", () => {
    const asOf = new Date("2026-10-30T12:00:00Z");
    const series = unpackNgxSpark(packNgxSpark([pt("2026-01-05", 10), pt("2026-03-05", 11), pt("2026-06-05", 12)]));
    expect(filterSeriesByHorizon(series, "1S", asOf)).toEqual([]);
    expect(filterSeriesByHorizon(series, "1A", asOf)).toHaveLength(3);
  });
});
