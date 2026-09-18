import { describe, expect, it } from "vitest";
import {
  isPortfolioType,
  parsePortfolioType,
  PORTFOLIO_TYPE_META,
  PORTFOLIO_TYPES,
} from "./types";

describe("portfolio types", () => {
  it("expose les quatre cadres du document produit", () => {
    expect(PORTFOLIO_TYPES).toEqual(["CROISSANCE", "RENTE", "TRADING", "CROISSANCE_MAX"]);
    expect(PORTFOLIO_TYPE_META.CROISSANCE.label).toBe("Croissance");
    expect(PORTFOLIO_TYPE_META.RENTE.label).toBe("Rente");
    expect(PORTFOLIO_TYPE_META.TRADING.label).toBe("Trading");
    expect(PORTFOLIO_TYPE_META.CROISSANCE_MAX.label).toBe("Croissance Max");
  });

  it("parse de façon stricte", () => {
    expect(isPortfolioType("CROISSANCE")).toBe(true);
    expect(parsePortfolioType("TRADING")).toBe("TRADING");
    expect(parsePortfolioType("growth")).toBeNull();
    expect(parsePortfolioType(null)).toBeNull();
  });

  it("fournit des hypothèses de simulation distinctes (pédagogiques)", () => {
    const g = PORTFOLIO_TYPE_META.CROISSANCE.simulation;
    const t = PORTFOLIO_TYPE_META.TRADING.simulation;
    expect(Number(g.years)).toBeGreaterThan(Number(t.years));
    expect(Number(t.fees)).toBeGreaterThan(Number(g.fees));
    expect(Number(t.spread)).toBeGreaterThan(Number(g.spread));
  });

  it("pointe chaque type vers une fiche Éducation", () => {
    for (const id of PORTFOLIO_TYPES) {
      expect(PORTFOLIO_TYPE_META[id].educationHref).toContain("/education/types-de-portefeuille/");
      expect(PORTFOLIO_TYPE_META[id].analysis.emphasisSlugs.length).toBeGreaterThan(0);
    }
  });
});
