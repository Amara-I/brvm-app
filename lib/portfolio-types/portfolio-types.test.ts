import { describe, expect, it } from "vitest";
import { calcMetrics, type CalcMetricsInput } from "@/lib/calc/calc-metrics";
import {
  COMMON_PORTFOLIO_RULES,
  PORTFOLIO_TYPE_COMPARISON_ROWS,
  PORTFOLIO_TYPE_IDS,
  coercePortfolioType,
  frameCompanyForPortfolioType,
  getPortfolioTypeDef,
  keyTermSlugsForType,
  overviewScorecardForType,
  parsePortfolioType,
} from "./index";
import { getTermBySlug, getThemeBySlug, termsByTheme } from "@/lib/education/catalog";
import { PORTFOLIO_TYPE_ARTICLE_BLOCKS } from "@/lib/education/portfolio-type-articles";

const baseInput: CalcMetricsInput = {
  years: [2021, 2022, 2023, 2024, 2025, 2026],
  prices: { 2021: 100, 2022: 110, 2023: 120, 2024: 130, 2025: 140, 2026: 150 },
  dividends: { 2021: 5, 2022: 5, 2023: 6, 2024: 6, 2025: 7, 2026: 7 },
  per: 10,
  sector: "Télécoms",
  mktcap: 1000,
};

describe("portfolio types", () => {
  it("parse les quatre identifiants et refuse le reste", () => {
    expect(PORTFOLIO_TYPE_IDS).toEqual(["CROISSANCE", "RENTE", "TRADING", "CROISSANCE_MAX"]);
    expect(parsePortfolioType("RENTE")).toBe("RENTE");
    expect(parsePortfolioType("inconnu")).toBeNull();
    expect(coercePortfolioType("nope")).toBe("CROISSANCE");
  });

  it("expose un tableau comparatif aligné sur le cadre pédagogique", () => {
    expect(PORTFOLIO_TYPE_COMPARISON_ROWS).toHaveLength(4);
    expect(PORTFOLIO_TYPE_COMPARISON_ROWS.map((r) => r[0])).toEqual([
      "Croissance",
      "Rente",
      "Trading",
      "Croissance Max",
    ]);
    expect(COMMON_PORTFOLIO_RULES.length).toBeGreaterThanOrEqual(4);
  });

  it("cadre une fiche avec les métriques réelles, sans inventer de N/D", () => {
    const metrics = calcMetrics(baseInput);
    const framed = frameCompanyForPortfolioType({
      type: "TRADING",
      ticker: "SNTS",
      name: "Sonatel",
      metrics,
    });
    expect(framed.metrics.some((m) => m.label === "Risque (volatilité)")).toBe(true);
    expect(framed.metrics.every((m) => m.value !== "" && m.value != null)).toBe(true);
    expect(framed.warnings.some((w) => /liquidité/i.test(w))).toBe(true);
    expect(framed.ctas.some((c) => c.href.includes("taille-position"))).toBe(true);
    expect(framed.disclaimer).toMatch(/pas un conseil/i);
  });

  it("change les cellules de scorecard selon le type", () => {
    const metrics = calcMetrics(baseInput);
    const growth = overviewScorecardForType("CROISSANCE", metrics).map((c) => c.k);
    const trading = overviewScorecardForType("TRADING", metrics).map((c) => c.k);
    expect(growth).toContain("Fondamental");
    expect(trading).toContain("Technique");
    expect(trading).toContain("Volatilité");
    expect(overviewScorecardForType("RENTE", metrics)[0]?.k).toBe("Rend. div.");
  });

  it("relie chaque type à une fiche Éducation complète", () => {
    const theme = getThemeBySlug("types-de-portefeuille");
    expect(theme?.title).toBe("Types de portefeuille");
    const slugs = termsByTheme("types-de-portefeuille").map((t) => t.slug);
    expect(slugs).toEqual([
      "types-de-portefeuille",
      "portefeuille-croissance",
      "portefeuille-rente",
      "portefeuille-trading",
      "portefeuille-croissance-max",
      "portefeuille-regles-communes",
    ]);
    for (const id of PORTFOLIO_TYPE_IDS) {
      const def = getPortfolioTypeDef(id);
      const term = getTermBySlug(def.educationSlug);
      expect(term?.blocks?.length, def.educationSlug).toBeGreaterThan(3);
      expect(term?.blocks?.some((b) => b.type === "table"), def.educationSlug).toBe(true);
      for (const slug of keyTermSlugsForType(id)) {
        expect(getTermBySlug(slug), slug).toBeTruthy();
      }
    }
    expect(Object.keys(PORTFOLIO_TYPE_ARTICLE_BLOCKS)).toEqual(slugs);
  });
});
