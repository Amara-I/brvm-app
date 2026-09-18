import { describe, expect, it } from "vitest";
import {
  EDUCATION_TERMS,
  EDUCATION_THEMES,
  getTermBySlug,
  getThemeBySlug,
  termsByTheme,
} from "./catalog";

describe("education catalog — taille de position", () => {
  it("expose le thème et les 3 fiches", () => {
    const theme = getThemeBySlug("taille-position");
    expect(theme?.title).toBe("Taille de position");
    expect(theme?.categorySlug).toBe("risques");

    const terms = termsByTheme("taille-position");
    expect(terms.map((t) => t.slug)).toEqual([
      "taille-de-position",
      "taux-perte-acceptable",
      "stop-loss-brvm",
    ]);
  });

  it("relie la fiche méthode à la calculette", () => {
    const term = getTermBySlug("taille-de-position");
    expect(term?.ctaHref).toBe("/outils/taille-position?example=sogb");
    expect(term?.example).toMatch(/60 titres/);
    expect(term?.details).toMatch(/Q = \(capital/);
  });

  it("relie les fiches types de portefeuille à des slugs existants", () => {
    const slugs = new Set(EDUCATION_TERMS.map((t) => t.slug));
    for (const term of termsByTheme("types-de-portefeuille")) {
      for (const rel of term.relatedSlugs ?? []) {
        expect(slugs.has(rel), `${term.slug} → ${rel}`).toBe(true);
      }
    }
  });

  it("conserve des slugs uniques", () => {
    const slugs = EDUCATION_TERMS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const themeSlugs = EDUCATION_THEMES.map((t) => t.slug);
    expect(new Set(themeSlugs).size).toBe(themeSlugs.length);
  });

  it("expose le thème Types de portefeuille et six fiches", () => {
    const theme = getThemeBySlug("types-de-portefeuille");
    expect(theme?.title).toBe("Types de portefeuille");
    expect(theme?.categorySlug).toBe("analyse");
    const slugs = termsByTheme("types-de-portefeuille").map((t) => t.slug);
    expect(slugs).toEqual([
      "cadre-quatre-portefeuilles-brvm",
      "portefeuille-croissance",
      "portefeuille-rente",
      "portefeuille-trading",
      "portefeuille-croissance-max",
      "croissance-max-structure-reequilibrage",
    ]);
    const croissance = getTermBySlug("portefeuille-croissance");
    expect(croissance?.details).toMatch(/compartiment Croissance/i);
    expect(croissance?.details).toMatch(/30 %/);
    const trading = getTermBySlug("portefeuille-trading");
    expect(trading?.details).toMatch(/BRVM-30/);
    expect(trading?.details).toMatch(/\\\\frac|frac/);
    const rente = getTermBySlug("portefeuille-rente");
    expect(rente?.details).toMatch(/Rendement courant/);
  });

  it("explique la gestion du risque (fiche + piliers)", () => {
    const term = getTermBySlug("gestion-du-risque");
    expect(term?.themeSlug).toBe("risques");
    expect(term?.definition).toMatch(/score 0–100/i);
    expect(term?.relatedSlugs).toContain("taille-de-position");
    expect(getTermBySlug("risque-de-marche")?.title).toBe("Risque de marché");
    expect(getTermBySlug("risque-fondamental")?.title).toBe("Risque fondamental");
    expect(getTermBySlug("risque-operationnel")?.title).toBe("Risque opérationnel");
  });
});
