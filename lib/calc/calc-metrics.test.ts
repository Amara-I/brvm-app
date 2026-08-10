// ═══════════════════════════════════════════════════════════════════════════
// Tests de non-régression — calcMetrics vs. sortie de reference/BRVM_Dashboard.jsx
// ═══════════════════════════════════════════════════════════════════════════
// Compare la sortie de la nouvelle implémentation TypeScript strict aux 20
// sociétés du jeu de données d'origine, contre la fixture générée en
// exécutant une copie verbatim du code JSX (cf.
// lib/calc/__fixtures__/generate-golden-fixtures.ts). Toute divergence ici
// indiquerait que le futur branchement du dashboard sur l'API (étape 8)
// changerait un chiffre affiché — ce qui est interdit par les contraintes
// non négociables du projet.

import { describe, expect, it } from "vitest";
import { calcMetrics } from "./calc-metrics";
import { COMPANIES_FULL, YEARS, LEGACY_COMPANY_TICKERS } from "../../prisma/seed-data/companies-full";
import golden from "./__fixtures__/golden-legacy-output.json";

const YEARS_ARRAY = [...YEARS];
const LEGACY_SET = new Set<string>(LEGACY_COMPANY_TICKERS);

describe("calcMetrics — parité avec le JSX d'origine", () => {
  // Les 27 sociétés ajoutées le 10/08/2026 (criblage BRVM officiel) n'ont
  // PAS de référence dans le JSX d'origine ni dans la fixture golden — on
  // ne les teste donc PAS ici (elles n'ont de toute façon pas d'historique
  // multi-année comparable). Seules les 20 sociétés d'origine sont
  // confrontées à la fixture.
  const companiesWithGolden = COMPANIES_FULL.filter((c) => LEGACY_SET.has(c.ticker));

  it("couvre toujours les 20 sociétés d'origine du JSX", () => {
    expect(companiesWithGolden).toHaveLength(LEGACY_COMPANY_TICKERS.length);
  });

  for (const company of companiesWithGolden) {
    const expected = golden.find((g) => g.ticker === company.ticker)!;

    it(`produit les mêmes métriques que le JSX pour ${company.ticker}`, () => {
      const result = calcMetrics({
        years: YEARS_ARRAY,
        prices: company.prices,
        dividends: company.dividends,
        per: company.per,
      });

      expect(result.perf5Percent).toBe(expected.metrics.perf5);
      expect(result.perf10Percent).toBe(expected.metrics.perf10);
      expect(String(result.avgDividend)).toBe(String(expected.metrics.avgDiv));
      expect(String(result.dividendYieldPercent)).toBe(String(expected.metrics.yield_));
      expect(result.volatilityPercent).toBe(expected.metrics.volat);
      expect(result.riskLevel).toBe(expected.metrics.risk);
      expect(result.score).toBe(expected.metrics.score);
      expect(result.signal.label).toBe(expected.metrics.sig.label);
      expect(result.signal.color).toBe(expected.metrics.sig.color);
      expect(result.currentPrice).toBe(expected.metrics.currentPrice);
      expect(result.currentDividend).toBe(expected.metrics.currentDiv);
    });
  }
});
