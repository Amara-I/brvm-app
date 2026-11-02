import { describe, it, expect } from "vitest";
import { searchListings, companyHref } from "./search";
const items = [
  { ticker: "SNTS", name: "Sonatel", sector: "Télécoms" },
  { ticker: "MTNN", name: "MTN Nigeria", sector: "Télécoms", exchange: "NGX" as const },
];
describe("recherche multi-marchés", () => {
  it("groupe les résultats sans mélanger les routes", () => {
    expect(searchListings(items, "télé").map((g) => g.items.length)).toEqual([1, 1]);
    expect(companyHref(items[0])).toBe("/actions/SNTS");
    expect(companyHref(items[1])).toBe("/marches/ngx/actions/MTNN");
  });
  it("filtre par marché et par nom sans tenir compte de la casse", () => {
    expect(searchListings(items, "mtn", "NGX")[0].items).toEqual([items[1]]);
    expect(searchListings(items, "mtn", "BRVM")[0].items).toEqual([]);
  });
  it("ne laisse pas un grand univers masquer l'autre", () => {
    expect(searchListings([...Array(20).fill(items[0]), items[1]], "").map((g) => g.items.length)).toEqual([5, 1]);
  });
});
