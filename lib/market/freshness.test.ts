import { describe, expect, it } from "vitest";
import { isSessionOpen, lastSessionStart, marketFreshness, freshnessExchangeOf } from "./freshness";

const d = (iso: string) => new Date(iso);

describe("isSessionOpen", () => {
  it("BRVM ouverte en semaine entre 09:00 et 15:30 UTC", () => {
    expect(isSessionOpen("BRVM", d("2026-11-20T09:00:00Z"))).toBe(true); // vendredi
    expect(isSessionOpen("BRVM", d("2026-11-20T15:30:00Z"))).toBe(true);
    expect(isSessionOpen("BRVM", d("2026-11-20T15:31:00Z"))).toBe(false);
    expect(isSessionOpen("BRVM", d("2026-11-20T08:59:00Z"))).toBe(false);
  });
  it("fermée le week-end", () => {
    expect(isSessionOpen("BRVM", d("2026-11-21T10:00:00Z"))).toBe(false); // samedi
    expect(isSessionOpen("NGX", d("2026-11-22T10:00:00Z"))).toBe(false); // dimanche
  });
  it("NGX a ses propres horaires (08:30–13:30 UTC)", () => {
    expect(isSessionOpen("NGX", d("2026-11-20T08:30:00Z"))).toBe(true);
    expect(isSessionOpen("NGX", d("2026-11-20T14:00:00Z"))).toBe(false);
  });
});

describe("lastSessionStart", () => {
  it("le samedi, renvoie l'ouverture du vendredi", () => {
    expect(lastSessionStart("BRVM", d("2026-11-21T12:00:00Z")).toISOString()).toBe(
      "2026-11-20T09:00:00.000Z"
    );
  });
  it("le lundi avant l'ouverture, renvoie l'ouverture du vendredi", () => {
    expect(lastSessionStart("BRVM", d("2026-11-23T07:00:00Z")).toISOString()).toBe(
      "2026-11-20T09:00:00.000Z"
    );
  });
  it("après l'ouverture du jour, renvoie celle du jour", () => {
    expect(lastSessionStart("BRVM", d("2026-11-23T16:00:00Z")).toISOString()).toBe(
      "2026-11-23T09:00:00.000Z"
    );
  });
});

describe("marketFreshness", () => {
  it("LIVE : séance ouverte et synchro récente", () => {
    expect(
      marketFreshness({ exchange: "BRVM", asOf: "2026-11-20T11:40:00Z", now: d("2026-11-20T12:00:00Z") })
    ).toBe("LIVE");
  });
  it("STALE : séance ouverte mais synchro vieille de plus de 90 min", () => {
    expect(
      marketFreshness({ exchange: "BRVM", asOf: "2026-11-20T09:10:00Z", now: d("2026-11-20T12:00:00Z") })
    ).toBe("STALE");
  });
  it("CLOSED : séance finie, données prises pendant/après la séance du jour", () => {
    expect(
      marketFreshness({ exchange: "BRVM", asOf: "2026-11-20T15:35:00Z", now: d("2026-11-20T18:00:00Z") })
    ).toBe("CLOSED");
  });
  it("CLOSED le week-end avec les données du vendredi", () => {
    expect(
      marketFreshness({ exchange: "BRVM", asOf: "2026-11-20T16:05:00Z", now: d("2026-11-22T10:00:00Z") })
    ).toBe("CLOSED");
  });
  it("STALE : données antérieures à la dernière séance", () => {
    expect(
      marketFreshness({ exchange: "BRVM", asOf: "2026-11-18T16:00:00Z", now: d("2026-11-20T18:00:00Z") })
    ).toBe("STALE");
  });
  it("UNKNOWN : pas de date ou date invalide", () => {
    expect(marketFreshness({ exchange: "BRVM", asOf: null, now: d("2026-11-20T12:00:00Z") })).toBe("UNKNOWN");
    expect(marketFreshness({ exchange: "BRVM", asOf: "pas une date", now: d("2026-11-20T12:00:00Z") })).toBe("UNKNOWN");
  });
});

describe("freshnessExchangeOf", () => {
  it("ne reconnaît que BRVM et NGX", () => {
    expect(freshnessExchangeOf("BRVM")).toBe("BRVM");
    expect(freshnessExchangeOf("NGX")).toBe("NGX");
    expect(freshnessExchangeOf("JSE")).toBeNull();
    expect(freshnessExchangeOf(undefined)).toBeNull();
  });
});
