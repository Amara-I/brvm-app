// ═══════════════════════════════════════════════════════════════════════════
// Tests de non-régression — projectPrices vs. sortie de reference/BRVM_Dashboard.jsx
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";
import { projectPrices } from "./project-prices";
import { COMPANIES_FULL, YEARS, LEGACY_COMPANY_TICKERS } from "../../prisma/seed-data/companies-full";
import golden from "./__fixtures__/golden-legacy-output.json";

const YEARS_ARRAY = [...YEARS];
const LEGACY_SET = new Set<string>(LEGACY_COMPANY_TICKERS);

describe("projectPrices — parité avec le JSX d'origine", () => {
  // Même filtre que calc-metrics.test.ts : seules les 20 sociétés présentes
  // dans la fixture golden (issues du JSX d'origine) sont confrontées.
  const companiesWithGolden = COMPANIES_FULL.filter((c) => LEGACY_SET.has(c.ticker));

  for (const company of companiesWithGolden) {
    const expected = golden.find((g) => g.ticker === company.ticker)!;

    it(`produit les mêmes projections à 5 ans que le JSX pour ${company.ticker}`, () => {
      const historicalPrices = YEARS_ARRAY.map((year) => ({ year, price: company.prices[year] ?? 0 }));

      // Le JSX d'origine appelle `projectPrices(co, 5)` et numérote les
      // années projetées à partir de 2026 codé en dur ("2026 + i + 1"),
      // quelle que soit la dernière année réellement disponible pour la
      // société. On reproduit ce point de départ ici via `baseYear: 2026`
      // pour garantir une comparaison à l'identique (cf. commentaire dans
      // project-prices.ts sur `baseYear`).
      const result = projectPrices(historicalPrices, { futureYears: 5, baseYear: 2026 });

      expect(result).toEqual(expected.projections);
    });
  }
});
