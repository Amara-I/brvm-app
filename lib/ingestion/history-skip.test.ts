import { describe, expect, it } from "vitest";
import {
  isSikaNodataError,
  shouldSkipHistoryTicker,
  DEFAULT_SIKA_NODATA_TICKERS,
} from "./history-skip";

describe("isSikaNodataError", () => {
  it("détecte nodata dans le message GetHistos", () => {
    expect(isSikaNodataError("GetHistos NEIC.cc (0): nodata")).toBe(true);
    expect(isSikaNodataError("GetHistos PRSC: NoData")).toBe(true);
    expect(isSikaNodataError("toolong")).toBe(false);
    expect(isSikaNodataError(null)).toBe(false);
  });
});

describe("shouldSkipHistoryTicker", () => {
  it("respecte le flag DB tant que skipUntil n'est pas dépassé", () => {
    expect(
      shouldSkipHistoryTicker({ ticker: "NEIC", skipHistoryBackfill: true, historySkipReason: "sika_nodata" })
    ).toEqual({ skip: true, reason: "sika_nodata" });

    const past = new Date("2020-01-01T00:00:00.000Z");
    expect(
      shouldSkipHistoryTicker(
        { ticker: "NEIC", skipHistoryBackfill: true, historySkipUntil: past },
        new Date("2026-09-15T00:00:00.000Z")
      )
    ).toEqual({ skip: false, reason: null });
  });

  it("n'invente pas un skip sans flag ni env", () => {
    expect(shouldSkipHistoryTicker({ ticker: "SNTS" })).toEqual({ skip: false, reason: null });
  });

  it("contient les tickers ops connus (liste extensible, pas exclusive)", () => {
    for (const t of ["NEIC", "PRSC", "SEMC", "SICC", "SPHC", "STAC", "UNLC", "UNXC"]) {
      expect(DEFAULT_SIKA_NODATA_TICKERS).toContain(t);
    }
  });
});
