import { describe, expect, it } from "vitest";
import {
  focusRefreshGapMs,
  intradayMarkets,
  intradayWindowOpen,
  marketPhase,
  quotePollDelayMs,
  OPEN_POLL_MS,
  AFTER_CLOSE_POLL_MS,
  OFF_HOURS_POLL_MS,
} from "./market-hours";

// 2026-11-13 = vendredi, 2026-11-14 = samedi.
const at = (iso: string) => new Date(iso);

describe("marketPhase / quotePollDelayMs", () => {
  it("BRVM : 09:00–15:30 UTC en séance", () => {
    expect(marketPhase("BRVM", at("2026-11-13T08:59:00Z"))).toBe("offHours");
    expect(marketPhase("BRVM", at("2026-11-13T09:00:00Z"))).toBe("open");
    expect(marketPhase("BRVM", at("2026-11-13T15:29:00Z"))).toBe("open");
    expect(marketPhase("BRVM", at("2026-11-13T15:30:00Z"))).toBe("afterClose");
    expect(marketPhase("BRVM", at("2026-11-13T18:30:00Z"))).toBe("offHours");
    expect(quotePollDelayMs("BRVM", at("2026-11-13T12:00:00Z"))).toBe(OPEN_POLL_MS);
    expect(quotePollDelayMs("BRVM", at("2026-11-13T17:05:00Z"))).toBe(AFTER_CLOSE_POLL_MS);
    expect(quotePollDelayMs("BRVM", at("2026-11-13T22:00:00Z"))).toBe(OFF_HOURS_POLL_MS);
  });

  it("NGX : 09:30–14:30 Lagos = 08:30–13:30 UTC", () => {
    expect(marketPhase("NGX", at("2026-11-13T08:29:00Z"))).toBe("offHours");
    expect(marketPhase("NGX", at("2026-11-13T08:30:00Z"))).toBe("open");
    expect(marketPhase("NGX", at("2026-11-13T13:30:00Z"))).toBe("afterClose");
  });

  it("week-end : aucun sondage", () => {
    expect(marketPhase("BRVM", at("2026-11-14T12:00:00Z"))).toBe("weekend");
    expect(quotePollDelayMs("NGX", at("2026-11-15T10:00:00Z"))).toBeNull();
    expect(focusRefreshGapMs("BRVM", at("2026-11-15T10:00:00Z"))).toBe(OFF_HOURS_POLL_MS);
  });

  it("retour sur l'onglet : au moins 30 s d'écart", () => {
    expect(focusRefreshGapMs("BRVM", at("2026-11-13T12:00:00Z"))).toBe(OPEN_POLL_MS);
    expect(focusRefreshGapMs("BRVM", at("2026-11-13T22:00:00Z"))).toBe(OFF_HOURS_POLL_MS);
  });
});

describe("ingestion intrajournalière", () => {
  it("places demandées", () => {
    expect(intradayMarkets(null)).toEqual(["BRVM"]);
    expect(intradayMarkets("ngx")).toEqual(["NGX"]);
    expect(intradayMarkets("ALL")).toEqual(["BRVM", "NGX"]);
  });
  it("fenêtre : séance + 1 h après la clôture, jamais le week-end", () => {
    expect(intradayWindowOpen("BRVM", at("2026-11-13T10:00:00Z"))).toBe(true);
    expect(intradayWindowOpen("BRVM", at("2026-11-13T16:29:00Z"))).toBe(true);
    expect(intradayWindowOpen("BRVM", at("2026-11-13T16:31:00Z"))).toBe(false);
    expect(intradayWindowOpen("NGX", at("2026-11-13T14:00:00Z"))).toBe(true);
    expect(intradayWindowOpen("NGX", at("2026-11-13T15:00:00Z"))).toBe(false);
    expect(intradayWindowOpen("BRVM", at("2026-11-14T10:00:00Z"))).toBe(false);
  });
});
