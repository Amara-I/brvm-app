import { describe, expect, it } from "vitest";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";
import { chartSeriesNeedsRebuild, mergeTipPoints } from "./refresh-chart-series";

const sntsSplit: AdjustmentAction = {
  ticker: "SNTS",
  kind: "SPLIT",
  effectiveDate: "2026-10-26",
  factor: 10,
  oldShares: 1,
  newShares: 10,
  adjustPrices: true,
  label: "Fractionnement 1:10 le 26/10/2026",
};

describe("mergeTipPoints", () => {
  it("ne redivise pas une série déjà ajustée et ajuste seulement le nouveau point", () => {
    const merged = mergeTipPoints({
      cached: [{ time: "2026-10-22", value: 4200, volume: null }],
      cachedFingerprint: "2026-10-26:10",
      newRaw: [{ time: "2026-10-23", value: 43850, volume: null }],
      contextRaw: [{ time: "2026-10-22", value: 42000, volume: null }],
      actions: [sntsSplit],
    });
    expect(merged.points.find((point) => point.time === "2026-10-22")?.value).toBe(4200);
    expect(merged.points.find((point) => point.time === "2026-10-23")?.value).toBe(4385);
    expect(merged.fingerprint).toBe("2026-10-26:10");
  });

  it("traite un cache sans empreinte comme brut lorsqu'un fractionnement est actif", () => {
    const merged = mergeTipPoints({
      cached: [{ time: "2026-10-22", value: 42000, volume: null }],
      cachedFingerprint: null,
      newRaw: [],
      contextRaw: [],
      actions: [sntsSplit],
    });
    expect(merged.points.find((point) => point.time === "2026-10-22")?.value).toBe(4200);
  });

  it("accepte une empreinte absente quand il n'y a pas d'opération (indices)", () => {
    const merged = mergeTipPoints({
      cached: [{ time: "2026-09-18", value: 500, volume: null }],
      cachedFingerprint: null,
      newRaw: [{ time: "2026-10-26", value: 510, volume: null }],
      contextRaw: [],
      actions: [],
    });
    expect(merged.fingerprint).toBe("none");
    expect(merged.points.map((point) => point.value)).toEqual([500, 510]);
  });
});

describe("chartSeriesNeedsRebuild", () => {
  it("reconstruit si le cache est absent ou plus vieux", () => {
    expect(
      chartSeriesNeedsRebuild({
        cacheLastDate: null,
        latestCloseDate: "2026-10-26",
        cacheFingerprint: null,
        actionsFingerprint: "none",
      })
    ).toBe(true);
    expect(
      chartSeriesNeedsRebuild({
        cacheLastDate: "2026-09-18",
        latestCloseDate: "2026-10-26",
        cacheFingerprint: "none",
        actionsFingerprint: "none",
      })
    ).toBe(true);
  });

  it("saute une série à jour, y compris un indice sans empreinte en cache", () => {
    expect(
      chartSeriesNeedsRebuild({
        cacheLastDate: "2026-10-26",
        latestCloseDate: "2026-10-26",
        cacheFingerprint: "2026-10-26:10",
        actionsFingerprint: "2026-10-26:10",
      })
    ).toBe(false);
    expect(
      chartSeriesNeedsRebuild({
        cacheLastDate: "2026-10-26",
        latestCloseDate: "2026-10-26",
        cacheFingerprint: null,
        actionsFingerprint: "none",
      })
    ).toBe(false);
  });

  it("reconstruit si l'empreinte de fractionnement ne correspond pas", () => {
    expect(
      chartSeriesNeedsRebuild({
        cacheLastDate: "2026-10-26",
        latestCloseDate: "2026-10-26",
        cacheFingerprint: null,
        actionsFingerprint: "2026-10-26:10",
      })
    ).toBe(true);
  });
});
