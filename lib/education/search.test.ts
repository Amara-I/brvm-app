import { describe, expect, it } from "vitest";
import { foldEducationQuery, rankEducationSearch, searchEducationTerms } from "./search";
import { getTermBySlug } from "./catalog";

describe("foldEducationQuery", () => {
  it("retire les accents et la casse", () => {
    expect(foldEducationQuery("Gestion du Risque")).toBe("gestion du risque");
    expect(foldEducationQuery("volatilité")).toBe("volatilite");
    expect(foldEducationQuery("N/D")).toBe("n d");
  });
});

describe("searchEducationTerms", () => {
  it("matche un terme malgré les accents", () => {
    const hits = searchEducationTerms("volatilité");
    expect(hits.some((t) => t.slug === "volatilite")).toBe(true);
  });

  it("classe « gestion du risque » en tête via alias", () => {
    const ranked = rankEducationSearch("gestion du risque");
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]?.slug).toBe("gestion-du-risque");
  });

  it("matche un mot partiel (préfixe)", () => {
    const hits = searchEducationTerms("volat");
    expect(hits.some((t) => t.slug === "volatilite")).toBe(true);
  });

  it("matche un synonyme (PER)", () => {
    const ranked = rankEducationSearch("PER");
    expect(ranked[0]?.slug).toBe("per-price-earnings-ratio");
  });

  it("matche « cours actuel » via alias", () => {
    const ranked = rankEducationSearch("cours actuel");
    expect(ranked[0]?.slug).toBe("cours");
  });

  it("matche « types de portefeuille » via alias", () => {
    const ranked = rankEducationSearch("types de portefeuille");
    expect(ranked[0]?.slug).toBe("cadre-quatre-portefeuilles-brvm");
  });

  it("matche sizing → taille de position", () => {
    const ranked = rankEducationSearch("sizing");
    expect(ranked.some((t) => t.slug === "taille-de-position")).toBe(true);
  });

  it("matche N/D via alias sans noyer les résultats", () => {
    const ranked = rankEducationSearch("N/D");
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.length).toBeLessThan(15);
    expect(ranked[0]?.slug).toBe("donnee-n-d");
  });

  it("retourne [] si requête vide", () => {
    expect(searchEducationTerms("   ")).toEqual([]);
  });

  it("ne casse pas un slug catalogue existant", () => {
    expect(getTermBySlug("rsi")?.title).toBe("RSI");
  });
});
