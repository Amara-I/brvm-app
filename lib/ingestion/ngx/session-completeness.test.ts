import { describe, expect, it } from "vitest";
import {
  expectedSessionCount,
  isNgxSessionComplete,
  NGX_SESSION_DONE_FLOOR,
  sessionCompleteIn,
} from "./session-completeness";
import { matchSummaryToListings, ngxNamedListings, type DailySummaryRow } from "./daily-summary";

describe("complétude d'une séance NGX", () => {
  const counts = new Map<string, number>([
    ["2026-04-06", 124],
    ["2026-04-07", 87],
    ["2026-04-08", 87],
    ["2026-04-09", 125],
    ["2026-04-10", 87],
    ["2026-04-13", 125],
    ["2026-04-14", 124],
    ["2026-04-15", 126],
  ]);

  it("prend la médiane des séances voisines, hors séance jugée", () => {
    expect(expectedSessionCount(counts, "2026-04-10")).toBe(124);
  });

  it("une séance repliée à 87 titres sur ~124 n'est plus « complète »", () => {
    // Ancien critère : 87 ≥ 80 → sautée à jamais par le backfill.
    expect(87 >= NGX_SESSION_DONE_FLOOR).toBe(true);
    expect(sessionCompleteIn(counts, "2026-04-10")).toBe(false);
    expect(sessionCompleteIn(counts, "2026-04-13")).toBe(true);
  });

  it("une séance absente (0) n'est jamais complète", () => {
    expect(sessionCompleteIn(counts, "2026-04-16")).toBe(false);
    expect(isNgxSessionComplete(0, null)).toBe(false);
  });

  it("sans voisine, garde le seuil historique de 80 clôtures", () => {
    expect(isNgxSessionComplete(80, null)).toBe(true);
    expect(isNgxSessionComplete(79, null)).toBe(false);
  });

  it("tolère une baisse de 10 % (titres non échangés)", () => {
    expect(isNgxSessionComplete(112, 124)).toBe(true);
    expect(isNgxSessionComplete(111, 124)).toBe(false);
  });
});

describe("appariement Daily Summary", () => {
  const row = (name: string, close: number): DailySummaryRow => ({
    name,
    close,
    changePercent: null,
    trades: 1,
    volume: 1,
    sector: null,
    board: null,
  });

  it("apparie aussi la raison sociale officielle (profileMeta.legalName)", () => {
    const listings = ngxNamedListings([
      { ticker: "ACCESSCORP", name: "Access Holdings", profileMeta: { legalName: "ACCESS HOLDINGS PLC" } },
      { ticker: "JAIZBANK", name: "Jaiz Bank", profileMeta: { legalName: "JAIZ BANK PLC" } },
      { ticker: "MTNN", name: "MTN NIGERIA COMMUNICATIONS PLC", profileMeta: null },
    ]);
    const matched = matchSummaryToListings(
      [row("ACCESS HOLDINGS PLC", 26), row("JAIZ BANK PLC", 4.5), row("MTN NIGERIA COMMUNICATIONS PLC", 745)],
      listings
    );
    expect(matched.map((m) => m.ticker)).toEqual(["ACCESSCORP", "JAIZBANK", "MTNN"]);
  });

  it("deux libellés d'une même société ne la rendent pas ambiguë", () => {
    const listings = [
      { ticker: "UBA", name: "UNITED BANK FOR AFRICA PLC" },
      { ticker: "UBA", name: "United Bank for Africa Plc." },
    ];
    expect(matchSummaryToListings([row("UNITED BANK FOR AFRICA PLC", 47)], listings)).toHaveLength(1);
  });

  it("un nom porté par deux tickers reste ignoré", () => {
    const listings = [
      { ticker: "AAA", name: "SAME NAME PLC" },
      { ticker: "BBB", name: "SAME NAME PLC" },
    ];
    expect(matchSummaryToListings([row("SAME NAME PLC", 1)], listings)).toHaveLength(0);
  });
});
