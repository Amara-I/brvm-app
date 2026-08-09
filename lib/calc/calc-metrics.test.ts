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
import { COMPANIES_FULL, YEARS } from "../../prisma/seed-data/companies-full";
import golden from "./__fixtures__/golden-legacy-output.json";

const YEARS_ARRAY = [...YEARS];

describe("calcMetrics — parité avec le JSX d'origine", () => {
  for (const company of COMPANIES_FULL) {
    const expected = golden.find((g) => g.ticker === company.ticker);

    it(`produit les mêmes métriques que le JSX pour ${company.ticker}`, () => {
      expect(expected).toBeDefined();
      const result = calcMetrics({
        years: YEARS_ARRAY,
        prices: company.prices,
        dividends: company.dividends,
        per: company.per,
      });

      expect(result.perf5Percent).toBe(expected!.metrics.perf5);
      expect(result.perf10Percent).toBe(expected!.metrics.perf10);
      expect(String(result.avgDividend)).toBe(String(expected!.metrics.avgDiv));
      expect(String(result.dividendYieldPercent)).toBe(String(expected!.metrics.yield_));
      expect(result.volatilityPercent).toBe(expected!.metrics.volat);
      expect(result.riskLevel).toBe(expected!.metrics.risk);
      expect(result.score).toBe(expected!.metrics.score);
      expect(result.signal.label).toBe(expected!.metrics.sig.label);
      expect(result.signal.color).toBe(expected!.metrics.sig.color);
      expect(result.currentPrice).toBe(expected!.metrics.currentPrice);
      expect(result.currentDividend).toBe(expected!.metrics.currentDiv);
    });
  }
});
