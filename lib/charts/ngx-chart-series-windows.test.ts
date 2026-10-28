import { describe, expect, it } from "vitest";
import { applyChartSeriesWindow } from "./chart-window";
import { CHART_CACHE_LOOKBACK_PAD_DAYS, sliceForCacheRange, extendCutoffIso, CHART_SERIES_RANGE_KEYS } from "./chart-series-cache";
import { chartSeriesNeedsRebuild } from "./refresh-chart-series";
import { chartRangeCutoffIso, lastPointAsOf } from "./chart-window";
import type { ChartClosePoint } from "./indicators";

/** 5 ans de séances (lun-ven) du 27/10/2021 au 27/10/2026, comme l'historique NGX chargé. */
function ngxFiveYears(): ChartClosePoint[] {
  const out: ChartClosePoint[] = [];
  const day = new Date("2021-10-27T00:00:00.000Z");
  const end = new Date("2026-10-27T00:00:00.000Z");
  let v = 100;
  while (day <= end) {
    const dow = day.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      v += 0.5;
      out.push({ time: day.toISOString().slice(0, 10), value: v, volume: 1000 });
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return out;
}

describe("fenêtres chart_series (NGX, 5 ans de séances)", () => {
  const full = ngxFiveYears();
  const asOf = lastPointAsOf(full);

  it("chaque ligne stockée commence au repère de la fenêtre moins le padding SMA 200", () => {
    for (const key of ["1M", "3M", "6M", "1A", "5A"] as const) {
      const slice = sliceForCacheRange(full, key);
      const cutoff = chartRangeCutoffIso(key, asOf);
      const from = extendCutoffIso(cutoff, CHART_CACHE_LOOKBACK_PAD_DAYS);
      expect(slice.length).toBeGreaterThan(1);
      expect(slice[0]!.time >= from).toBe(true);
      // Le point précédant la ligne stockée est antérieur au repère : rien n'est coupé en trop.
      const before = full.filter((p) => p.time < slice[0]!.time).pop();
      if (before) expect(before.time < from).toBe(true);
      expect(slice[slice.length - 1]!.time).toBe("2026-10-27");
    }
  });

  it("MAX garde tout l'historique, SPARK reste léger", () => {
    expect(sliceForCacheRange(full, "MAX")).toHaveLength(full.length);
    const spark = sliceForCacheRange(full, "SPARK");
    expect(spark.length).toBeLessThan(400);
    expect(spark[spark.length - 1]!.time).toBe("2026-10-27");
  });

  it("les lignes sont emboîtées : 1M ⊂ 3M ⊂ 6M ⊂ 1A ⊂ 5A ⊂ MAX", () => {
    const sizes = (["1M", "3M", "6M", "1A", "5A", "MAX"] as const).map((k) => sliceForCacheRange(full, k).length);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
    // 5A = MAX ici : le cutoff 5 ans − padding est antérieur au premier point.
    expect(new Set(sizes.slice(0, 5)).size).toBe(5);
  });

  it("la fenêtre appliquée à la lecture ne montre qu'un mois pour 1M, malgré le padding stocké", () => {
    const stored = sliceForCacheRange(full, "1M");
    expect(stored.length).toBeGreaterThan(250);
    const shown = applyChartSeriesWindow(stored, { range: "1M" }).series;
    expect(shown[0]!.time >= "2026-09-27").toBe(true);
    expect(shown.length).toBeGreaterThanOrEqual(19);
    expect(shown.length).toBeLessThanOrEqual(24);
  });

  it("ne produit aucune ligne vide pour une série à un seul point, ni pour une série vide", () => {
    const one = [{ time: "2026-10-27", value: 10, volume: null }];
    for (const key of CHART_SERIES_RANGE_KEYS) {
      expect(sliceForCacheRange(one, key).length).toBeLessThanOrEqual(1);
      expect(sliceForCacheRange([], key)).toEqual([]);
    }
  });
});

describe("chartSeriesNeedsRebuild : historique chargé après coup", () => {
  const base = { cacheLastDate: "2026-10-27", latestCloseDate: "2026-10-27", cacheFingerprint: "none", actionsFingerprint: "none" };

  it("ne rebuild pas un cache complet", () => {
    expect(chartSeriesNeedsRebuild({ ...base, cachePoints: 880, canonicalDays: 880 })).toBe(false);
  });

  it("rebuild un cache à 1 point alors que la base a 5 ans (même dernière date)", () => {
    expect(chartSeriesNeedsRebuild({ ...base, cachePoints: 1, canonicalDays: 880 })).toBe(true);
  });

  it("ignore la profondeur quand elle n'est pas fournie (BRVM)", () => {
    expect(chartSeriesNeedsRebuild({ ...base, cachePoints: 1 })).toBe(false);
  });

  it("garde le comportement existant : cache en retard ou absent", () => {
    expect(chartSeriesNeedsRebuild({ ...base, cacheLastDate: "2026-10-26" })).toBe(true);
    expect(chartSeriesNeedsRebuild({ ...base, cacheLastDate: null })).toBe(true);
  });
});
