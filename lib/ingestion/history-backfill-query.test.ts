import { describe, expect, it } from "vitest";
import { parseHistoryBackfillSearchParams } from "./history-backfill-query";

describe("parseHistoryBackfillSearchParams", () => {
  it("forceDaily=1 active le journalier même avec noDaily=1 / dailyFrom=off", () => {
    const q = new URLSearchParams("forceDaily=1&noDaily=1&dailyFrom=off&tickers=BICC&maxTickers=1");
    const parsed = parseHistoryBackfillSearchParams(q);
    expect(parsed.forceDaily).toBe(true);
    expect(parsed.includeDaily).toBe(true);
    expect(parsed.tickers).toEqual(["BICC"]);
    expect(parsed.maxTickers).toBe(1);
    expect(parsed.minDailyPoints).toBe(35);
  });

  it("minDailyPoints override ops", () => {
    const q = new URLSearchParams("forceDaily=true&minDailyPoints=1&maxDailyChunks=3");
    const parsed = parseHistoryBackfillSearchParams(q);
    expect(parsed.minDailyPoints).toBe(1);
    expect(parsed.maxDailyChunks).toBe(3);
  });

  it("défaut dailyFrom = 1Y (politique couverture récente d'abord)", () => {
    const parsed = parseHistoryBackfillSearchParams(new URLSearchParams());
    expect(parsed.dailyFrom).toBe("1Y");
  });

  it("dailyFrom=auto conserve l'historique profond", () => {
    const parsed = parseHistoryBackfillSearchParams(new URLSearchParams("dailyFrom=auto"));
    expect(parsed.dailyFrom).toBe("auto");
  });

  it("after reste exclusif (reprise manuelle ticker suivant)", () => {
    const q = new URLSearchParams("after=BICC");
    const parsed = parseHistoryBackfillSearchParams(q);
    expect(parsed.resumeAfterTicker).toBe("BICC");
    expect(parsed.resumeInclusive).toBe(false);
    expect(parsed.forceDaily).toBe(false);
  });
});
