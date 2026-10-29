import { describe, expect, it } from "vitest";
import { nextNgxOverviewSort, sortNgxOverview } from "./ngx-overview-sort";

const row = (ticker: string, changePercent: number | null, return1yPercent: number | null, score: number | null) => ({
  ticker,
  changePercent,
  return1yPercent,
  score,
});
const rows = [row("B", 1, null, 50), row("A", -2, 30, null), row("C", 3, -10, 70)];

describe("sortNgxOverview", () => {
  it("trie par score décroissant avec N/D en dernier", () => {
    expect(sortNgxOverview(rows, { key: "score", dir: "desc" }).map((r) => r.ticker)).toEqual(["C", "B", "A"]);
  });
  it("garde N/D en dernier en ordre croissant", () => {
    expect(sortNgxOverview(rows, { key: "change1y", dir: "asc" }).map((r) => r.ticker)).toEqual(["C", "A", "B"]);
  });
  it("trie par variation jour et par ticker", () => {
    expect(sortNgxOverview(rows, { key: "change", dir: "desc" }).map((r) => r.ticker)).toEqual(["C", "B", "A"]);
    expect(sortNgxOverview(rows, { key: "ticker", dir: "asc" }).map((r) => r.ticker)).toEqual(["A", "B", "C"]);
  });
  it("sans tri, garde l'ordre", () => {
    expect(sortNgxOverview(rows, null)).toBe(rows);
  });
});

describe("nextNgxOverviewSort", () => {
  it("cycle desc → asc → aucun pour une colonne numérique", () => {
    const a = nextNgxOverviewSort(null, "score");
    expect(a).toEqual({ key: "score", dir: "desc" });
    const b = nextNgxOverviewSort(a, "score");
    expect(b).toEqual({ key: "score", dir: "asc" });
    expect(nextNgxOverviewSort(b, "score")).toBeNull();
  });
  it("ticker commence A→Z", () => {
    expect(nextNgxOverviewSort(null, "ticker")).toEqual({ key: "ticker", dir: "asc" });
  });
});
