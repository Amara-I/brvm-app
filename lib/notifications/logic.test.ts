import { describe, expect, it } from "vitest";
import {
  alreadyFiredToday,
  clampDailyMovePct,
  dailyMoveHits,
  deepLinkFor,
  fireKey,
  fmtSignedPct,
  horizonReturnPct,
  hourInTimeZone,
  isInQuietHours,
  isSessionCloseWindow,
  isSessionOpenWindow,
  priceCrossHits,
} from "./logic";
import { BRVM_DAILY_COLLAR_MAX_PCT, BRVM_DAILY_COLLAR_PCT } from "./types";

describe("isInQuietHours", () => {
  it("désactive si une borne manque", () => {
    const noon = new Date("2026-09-13T12:00:00.000Z");
    expect(isInQuietHours(noon, null, 7)).toBe(false);
    expect(isInQuietHours(noon, 22, null)).toBe(false);
  });

  it("gère une plage intra-journée", () => {
    expect(isInQuietHours(new Date("2026-09-13T13:00:00.000Z"), 12, 14)).toBe(true);
    expect(isInQuietHours(new Date("2026-09-13T11:00:00.000Z"), 12, 14)).toBe(false);
  });

  it("gère une plage qui traverse minuit", () => {
    expect(isInQuietHours(new Date("2026-09-13T23:00:00.000Z"), 22, 7)).toBe(true);
    expect(isInQuietHours(new Date("2026-09-13T03:00:00.000Z"), 22, 7)).toBe(true);
    expect(isInQuietHours(new Date("2026-09-13T10:00:00.000Z"), 22, 7)).toBe(false);
  });
});

describe("clampDailyMovePct", () => {
  it("respecte le collier BRVM", () => {
    expect(clampDailyMovePct(0)).toBe(0.5);
    expect(clampDailyMovePct(3)).toBe(3);
    expect(clampDailyMovePct(7.5)).toBe(BRVM_DAILY_COLLAR_PCT);
    expect(clampDailyMovePct(50)).toBe(BRVM_DAILY_COLLAR_MAX_PCT);
  });
});

describe("dailyMoveHits / priceCrossHits", () => {
  it("déclenche à partir du seuil en valeur absolue", () => {
    expect(dailyMoveHits(-5, 5)).toBe(true);
    expect(dailyMoveHits(4.9, 5)).toBe(false);
    expect(dailyMoveHits(5, 5)).toBe(true);
  });

  it("compare un seuil de cours", () => {
    expect(priceCrossHits("ABOVE", 32000, 30000)).toBe(true);
    expect(priceCrossHits("BELOW", 18000, 20000)).toBe(true);
    expect(priceCrossHits("ABOVE", 29000, 30000)).toBe(false);
  });
});

describe("horizonReturnPct", () => {
  it("calcule une variation réelle, N/D si base nulle", () => {
    expect(horizonReturnPct(100, 110)).toBeCloseTo(10);
    expect(horizonReturnPct(0, 110)).toBeNull();
  });
});

describe("session windows (Abidjan = UTC)", () => {
  it("reconnaît ouverture et clôture", () => {
    expect(isSessionOpenWindow(new Date("2026-09-13T09:15:00.000Z"))).toBe(true);
    expect(isSessionCloseWindow(new Date("2026-09-13T16:00:00.000Z"))).toBe(true);
    expect(isSessionOpenWindow(new Date("2026-09-13T14:00:00.000Z"))).toBe(false);
    expect(hourInTimeZone(new Date("2026-09-13T09:00:00.000Z"))).toBe(9);
  });
});

describe("anti-spam + deep links", () => {
  it("déduplique une clé du jour", () => {
    const key = fireKey("2026-09-13", "SNTS", "ACHAT_FORT");
    expect(alreadyFiredToday(key, key)).toBe(true);
    expect(alreadyFiredToday("other", key)).toBe(false);
  });

  it("pointe vers fiche, graphe, portefeuille ou indice", () => {
    expect(deepLinkFor({ type: "PRIX", ticker: "SNTS" })).toBe("/actions/SNTS");
    expect(deepLinkFor({ type: "PRIX", ticker: "SNTS", preferChart: true })).toBe("/graphes?ticker=SNTS");
    expect(deepLinkFor({ type: "PORTEFEUILLE" })).toBe("/portefeuille");
    expect(deepLinkFor({ type: "INDICES", indexCode: "BRVM_30" })).toBe("/indices/BRVM_30");
  });

  it("formate un pourcentage signé", () => {
    expect(fmtSignedPct(-2.5)).toBe("−2,5 %");
  });
});
